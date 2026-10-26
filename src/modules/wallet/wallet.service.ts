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
import { CacheService, DEFAULT_TTL_SECONDS } from 'src/common/cache/cache.service';
import { toJson } from 'src/common/cache/jsonified';
import { WalletRepository } from './wallet.repository';
import { DepositDto, ReverseTransactionDto, StatementQueryDto, TransferDto } from './dto';

const REVERSAL_DESCRIPTION: Record<TransactionType, string> = {
  DEPOSIT: 'Estorno de depósito',
  TRANSFER: 'Estorno de transferência',
  REVERSAL: 'Estorno',
};

/** userId → walletId não muda (1:1, a carteira nasce com o usuário): pode ficar mais tempo no cache. */
const WALLET_ID_TTL_SECONDS = 24 * 60 * 60;

/**
 * Leituras (saldo, extrato) passam pelo Redis com chave por carteira + versão. Escritas incrementam a
 * versão das carteiras envolvidas DEPOIS do commit, e as chaves antigas deixam de ser lidas na hora.
 * Validação de saldo (lockWallets) nunca usa o cache.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly cache: CacheService,
  ) {}

  async getWallet(userId: string) {
    const load = async () => {
      const { id, balance, updatedAt } = await this.walletRepository.findWalletByUserId(userId);
      return { id, balance, updatedAt };
    };
    // Sem Redis, vai direto ao banco (sem a consulta extra do walletId)
    if (!this.cache.available) return toJson(await load());

    const walletId = await this.walletIdOf(userId);
    const version = await this.cache.walletVersion(walletId);
    return this.cache.remember(`wallet:${walletId}:v${version}:balance`, DEFAULT_TTL_SECONDS, load);
  }

  async getStatement(userId: string, query: StatementQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (!this.cache.available) {
      const wallet = await this.walletRepository.findWalletByUserId(userId);
      return toJson(await this.loadStatement(userId, wallet.id, { page, pageSize, from, to }));
    }

    const walletId = await this.walletIdOf(userId);
    const version = await this.cache.walletVersion(walletId);
    // ISO normalizado: "2026-09-01T03:00Z" e "2026-09-01T03:00:00.000Z" caem na mesma chave
    const key = `wallet:${walletId}:v${version}:stmt:${page}:${pageSize}:${from?.toISOString() ?? '-'}:${to?.toISOString() ?? '-'}`;
    return this.cache.remember(key, DEFAULT_TTL_SECONDS, () =>
      this.loadStatement(userId, walletId, { page, pageSize, from, to }),
    );
  }

  private async walletIdOf(userId: string) {
    return this.cache.remember(`user:${userId}:walletId`, WALLET_ID_TTL_SECONDS, async () => {
      const wallet = await this.walletRepository.findWalletByUserId(userId);
      return wallet.id;
    });
  }

  private async loadStatement(
    userId: string,
    walletId: string,
    { page, pageSize, from, to }: { page: number; pageSize: number; from?: Date; to?: Date },
  ) {
    const { count, rows } = await this.walletRepository.findStatement({ walletId, page, pageSize, from, to });

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

    const transaction = await this.withIdempotency(() =>
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

    // Depois do commit: se fosse dentro da transação, uma leitura no meio gravaria o estado antigo
    await this.cache.bumpWallets(transaction.toWalletId);
    return transaction;
  }

  async transfer(userId: string, dto: TransferDto) {
    const amount = new Prisma.Decimal(dto.amount);

    const replay = await this.findReplay(userId, dto.idempotencyKey);
    if (replay) return replay;

    const transaction = await this.withIdempotency(() =>
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

    // As duas pontas: quem recebeu também vê o saldo novo na próxima leitura
    await this.cache.bumpWallets(transaction.fromWalletId, transaction.toWalletId);
    return transaction;
  }

  async reverse(userId: string, transactionId: string, dto: ReverseTransactionDto) {
    const reversal = await this.walletRepository.runInTransaction(async (tx) => {
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

    // As carteiras da original (o estorno é o movimento inverso entre elas); canReverse também muda
    await this.cache.bumpWallets(reversal.fromWalletId, reversal.toWalletId);
    return reversal;
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
