import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { EntryDirection, TransactionStatus, TransactionType } from 'src/generated/prisma/enums';

type Tx = Prisma.TransactionClient;

export type WalletBalances = Map<string, Prisma.Decimal>;

export type PostTransactionInput = {
  type: TransactionType;
  amount: Prisma.Decimal;
  initiatorId: string;
  fromWalletId?: string | null;
  toWalletId?: string | null;
  description?: string;
  idempotencyKey?: string;
  reversalOfId?: string;
};

const counterpartSelect = {
  id: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.WalletSelect;

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  runInTransaction = <T>(fn: (tx: Tx) => Promise<T>) => {
    return this.prisma.$transaction(fn);
  };

  findWalletByUserId = async (userId: string, tx: Tx = this.prisma) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    return wallet;
  };

  findWalletByUserEmail = async (email: string, tx: Tx = this.prisma) => {
    return tx.wallet.findFirst({ where: { user: { email } } });
  };

  findTransactionById = async (id: string, tx: Tx = this.prisma) => {
    const transaction = await tx.transaction.findUnique({ where: { id } });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    return transaction;
  };

  findTransactionByIdempotencyKey = async (idempotencyKey: string) => {
    return this.prisma.transaction.findUnique({
      where: { idempotencyKey },
      include: { entries: true },
    });
  };

  /** Marca como REVERSED só se ainda estiver COMPLETED; retorna false se outra requisição chegou antes. */
  markAsReversed = async (id: string, tx: Tx) => {
    const { count } = await tx.transaction.updateMany({
      where: { id, status: TransactionStatus.COMPLETED },
      data: { status: TransactionStatus.REVERSED },
    });

    return count === 1;
  };

  /**
   * Trava as carteiras (SELECT ... FOR UPDATE) em ordem de id — ordem fixa evita deadlock
   * entre A→B e B→A simultâneos — e devolve o saldo atual de cada uma.
   */
  lockWallets = async (tx: Tx, walletIds: string[]): Promise<WalletBalances> => {
    const ids = [...new Set(walletIds)].sort();

    const rows = await tx.$queryRaw<{ id: string; balance: unknown }[]>`
      SELECT id, balance FROM wallets WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;

    if (rows.length !== ids.length) {
      throw new NotFoundException('Carteira não encontrada');
    }

    return new Map(rows.map((row) => [row.id, new Prisma.Decimal(String(row.balance))]));
  };

  /**
   * Grava a transação, os lançamentos e o novo saldo. Deve rodar dentro de runInTransaction,
   * com as carteiras já travadas. `from` sempre recebe DEBIT e `to` sempre recebe CREDIT.
   */
  postTransaction = async (tx: Tx, input: PostTransactionInput, balances: WalletBalances) => {
    const { amount, fromWalletId, toWalletId } = input;
    const entries: Prisma.LedgerEntryCreateWithoutTransactionInput[] = [];

    if (fromWalletId) {
      entries.push({
        wallet: { connect: { id: fromWalletId } },
        direction: EntryDirection.DEBIT,
        amount,
        balanceAfter: this.balanceOf(balances, fromWalletId).minus(amount),
      });
    }

    if (toWalletId) {
      entries.push({
        wallet: { connect: { id: toWalletId } },
        direction: EntryDirection.CREDIT,
        amount,
        balanceAfter: this.balanceOf(balances, toWalletId).plus(amount),
      });
    }

    const transaction = await tx.transaction.create({
      data: { ...input, entries: { create: entries } },
      include: { entries: true },
    });

    for (const entry of transaction.entries) {
      await tx.wallet.update({
        where: { id: entry.walletId },
        data: { balance: entry.balanceAfter },
      });
    }

    return transaction;
  };

  findStatement = async ({
    walletId,
    page,
    pageSize,
    from,
    to,
  }: {
    walletId: string;
    page: number;
    pageSize: number;
    from?: Date;
    to?: Date;
  }) => {
    const where: Prisma.LedgerEntryWhereInput = {
      walletId,
      createdAt: { gte: from, lt: to },
    };

    const [rows, count] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          transaction: {
            select: {
              id: true,
              type: true,
              status: true,
              description: true,
              reversalOfId: true,
              initiatorId: true,
              fromWallet: { select: counterpartSelect },
              toWallet: { select: counterpartSelect },
            },
          },
        },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return { count, rows };
  };

  private balanceOf(balances: WalletBalances, walletId: string) {
    const balance = balances.get(walletId);

    if (!balance) {
      throw new Error(`Carteira ${walletId} não foi travada antes de postTransaction`);
    }

    return balance;
  }
}
