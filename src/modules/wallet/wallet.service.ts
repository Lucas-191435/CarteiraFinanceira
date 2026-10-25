import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { TransactionStatus, TransactionType } from 'src/generated/prisma/enums';
import { WalletRepository } from './wallet.repository';
import { DepositDto, ReverseTransactionDto, StatementQueryDto, TransferDto } from './dto';

const REVERSAL_DESCRIPTION: Record<TransactionType, string> = {
  DEPOSIT: 'Estorno de depósito',
  TRANSFER: 'Estorno de transferência',
  REVERSAL: 'Estorno',
};

@Injectable()
export class WalletService {
  constructor(private readonly walletRepository: WalletRepository) {}

  async getWallet(userId: string) {
    const { id, balance, updatedAt } = await this.walletRepository.findWalletByUserId(userId);

    return { id, balance, updatedAt };
  }

  async getStatement(userId: string, query: StatementQueryDto) {
    const wallet = await this.walletRepository.findWalletByUserId(userId);

    const { count, rows } = await this.walletRepository.findStatement({
      walletId: wallet.id,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return {
      count,
      rows: rows.map(({ transaction, ...entry }) => {
        const { fromWallet, toWallet, initiatorId, ...transactionData } = transaction;
        // Contraparte = a outra carteira da transação (null em depósito e estorno de depósito)
        const counterpart = entry.walletId === fromWallet?.id ? toWallet : fromWallet;

        return {
          ...entry,
          transaction: {
            ...transactionData,
            counterpart: counterpart?.user ?? null,
            // Mesma regra do reverse(); o front só obedece (não expomos o initiatorId)
            canReverse:
              initiatorId === userId &&
              transactionData.status === TransactionStatus.COMPLETED &&
              transactionData.type !== TransactionType.REVERSAL,
          },
        };
      }),
    };
  }

  async deposit(userId: string, dto: DepositDto) {
    const amount = new Prisma.Decimal(dto.amount);

    const replay = await this.findReplay(userId, dto.idempotencyKey);
    if (replay) return replay;

    return this.withIdempotency(() =>
      this.walletRepository.runInTransaction(async (tx) => {
        const wallet = await this.walletRepository.findWalletByUserId(userId, tx);
        const balances = await this.walletRepository.lockWallets(tx, [wallet.id]);

        // Sem validação de saldo: se estiver negativo, o depósito simplesmente soma
        return this.walletRepository.postTransaction(
          tx,
          {
            type: TransactionType.DEPOSIT,
            amount,
            initiatorId: userId,
            toWalletId: wallet.id,
            description: dto.description,
            idempotencyKey: dto.idempotencyKey,
          },
          balances,
        );
      }),
    );
  }

  async transfer(userId: string, dto: TransferDto) {
    const amount = new Prisma.Decimal(dto.amount);

    const replay = await this.findReplay(userId, dto.idempotencyKey);
    if (replay) return replay;

    return this.withIdempotency(() =>
      this.walletRepository.runInTransaction(async (tx) => {
        const fromWallet = await this.walletRepository.findWalletByUserId(userId, tx);
        const toWallet = await this.walletRepository.findWalletByUserEmail(dto.toEmail, tx);

        if (!toWallet) {
          throw new NotFoundException('Destinatário não encontrado');
        }
        if (toWallet.id === fromWallet.id) {
          throw new BadRequestException('Não é possível transferir para si mesmo');
        }

        const balances = await this.walletRepository.lockWallets(tx, [fromWallet.id, toWallet.id]);

        // Validação feita com o saldo travado, nunca com o lido antes do lock
        if (balances.get(fromWallet.id)!.lessThan(amount)) {
          throw new UnprocessableEntityException('Saldo insuficiente');
        }

        return this.walletRepository.postTransaction(
          tx,
          {
            type: TransactionType.TRANSFER,
            amount,
            initiatorId: userId,
            fromWalletId: fromWallet.id,
            toWalletId: toWallet.id,
            description: dto.description,
            idempotencyKey: dto.idempotencyKey,
          },
          balances,
        );
      }),
    );
  }

  async reverse(userId: string, transactionId: string, dto: ReverseTransactionDto) {
    return this.walletRepository.runInTransaction(async (tx) => {
      const original = await this.walletRepository.findTransactionById(transactionId, tx);

      if (original.initiatorId !== userId) {
        throw new ForbiddenException('Somente quem realizou a operação pode solicitar o estorno');
      }
      if (original.type === TransactionType.REVERSAL) {
        throw new BadRequestException('Um estorno não pode ser revertido');
      }

      const marked = await this.walletRepository.markAsReversed(original.id, tx);
      if (!marked) {
        throw new ConflictException('Esta operação já foi revertida');
      }

      const walletIds = [original.fromWalletId, original.toWalletId].filter((id): id is string => !!id);
      const balances = await this.walletRepository.lockWallets(tx, walletIds);

      // Movimento inverso, sem validar saldo: quem recebeu pode ficar negativo
      return this.walletRepository.postTransaction(
        tx,
        {
          type: TransactionType.REVERSAL,
          amount: original.amount,
          initiatorId: userId,
          fromWalletId: original.toWalletId,
          toWalletId: original.fromWalletId,
          reversalOfId: original.id,
          description: dto.reason ?? REVERSAL_DESCRIPTION[original.type],
        },
        balances,
      );
    });
  }

  /**
   * Idempotência com replay: a mesma idempotencyKey do mesmo usuário devolve a transação original
   * (o cliente recebe a mesma resposta da primeira vez). De outro usuário, 409 — sem vazar a transação.
   */
  private async findReplay(userId: string, idempotencyKey?: string) {
    if (!idempotencyKey) return null;

    const existing = await this.walletRepository.findTransactionByIdempotencyKey(idempotencyKey);
    if (!existing) return null;

    if (existing.initiatorId !== userId) {
      throw new ConflictException('Operação já processada (idempotencyKey repetida)');
    }
    return existing;
  }

  /** Cobre a corrida entre duas requisições simultâneas com a mesma chave (a @unique decide). */
  private async withIdempotency<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      // P2002 = violação de unique em idempotencyKey: a mesma operação já foi processada
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Operação já processada (idempotencyKey repetida)');
      }
      throw error;
    }
  }
}
