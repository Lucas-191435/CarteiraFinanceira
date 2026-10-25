import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { PrismaModule } from 'src/common/database/prisma.module';
import { PrismaService } from 'src/common/database/prisma.service';
import { WalletModule } from 'src/modules/wallet/wallet.module';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { UserModule } from 'src/modules/user/user.module';
import { UserService } from 'src/modules/user/user.service';

describe('WalletService (integração com MySQL)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let walletService: WalletService;
  let userService: UserService;

  const createUser = async () => {
    const email = `user-${randomUUID()}@test.com`;
    const user = await prisma.user.create({
      data: { email, password: 'hash', name: 'Usuário de teste', wallet: { create: {} } },
    });
    return { id: user.id, email };
  };

  const balanceOf = async (userId: string) => {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    return wallet.balance.toNumber();
  };

  /** Invariante do ledger: balance == ΣCREDIT − ΣDEBIT e o último balanceAfter == balance. */
  const expectConsistent = async (userId: string) => {
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    const sum = wallet.entries.reduce(
      (acc, e) => (e.direction === 'CREDIT' ? acc + e.amount.toNumber() : acc - e.amount.toNumber()),
      0,
    );
    expect(sum).toBeCloseTo(wallet.balance.toNumber(), 2);
    const last = wallet.entries.at(-1);
    if (last) expect(last.balanceAfter.toNumber()).toBe(wallet.balance.toNumber());
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, WalletModule, UserModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    walletService = moduleRef.get(WalletService);
    userService = moduleRef.get(UserService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  describe('depósito', () => {
    it('soma ao saldo e cria um único lançamento CREDIT', async () => {
      const user = await createUser();

      const transaction = await walletService.deposit(user.id, { amount: 150.75 });

      expect(transaction.type).toBe('DEPOSIT');
      expect(transaction.fromWalletId).toBeNull();
      expect(transaction.entries).toHaveLength(1);
      expect(transaction.entries[0].direction).toBe('CREDIT');
      expect(await balanceOf(user.id)).toBe(150.75);
      await expectConsistent(user.id);
    });

    it('idempotencyKey repetida do mesmo usuário devolve a transação original sem duplicar', async () => {
      const user = await createUser();
      const idempotencyKey = randomUUID();

      const first = await walletService.deposit(user.id, { amount: 50, idempotencyKey });
      const replay = await walletService.deposit(user.id, { amount: 50, idempotencyKey });

      expect(replay.id).toBe(first.id);
      expect(replay.entries).toHaveLength(1);
      expect(await balanceOf(user.id)).toBe(50);
    });

    it('idempotencyKey de outro usuário dá conflito', async () => {
      const a = await createUser();
      const b = await createUser();
      const idempotencyKey = randomUUID();

      await walletService.deposit(a.id, { amount: 50, idempotencyKey });
      await expect(walletService.deposit(b.id, { amount: 50, idempotencyKey })).rejects.toThrow(ConflictException);
      expect(await balanceOf(b.id)).toBe(0);
    });
  });

  describe('transferência', () => {
    it('debita o remetente e credita o destinatário', async () => {
      const a = await createUser();
      const b = await createUser();
      await walletService.deposit(a.id, { amount: 100 });

      const transaction = await walletService.transfer(a.id, { toEmail: b.email, amount: 30 });

      const directions = Object.fromEntries(transaction.entries.map((e) => [e.walletId, e.direction]));
      expect(directions[transaction.fromWalletId!]).toBe('DEBIT');
      expect(directions[transaction.toWalletId!]).toBe('CREDIT');
      expect(await balanceOf(a.id)).toBe(70);
      expect(await balanceOf(b.id)).toBe(30);
      await expectConsistent(a.id);
      await expectConsistent(b.id);
    });

    it('recusa com saldo insuficiente e não altera nada', async () => {
      const a = await createUser();
      const b = await createUser();
      await walletService.deposit(a.id, { amount: 20 });

      await expect(walletService.transfer(a.id, { toEmail: b.email, amount: 20.01 })).rejects.toThrow(
        UnprocessableEntityException,
      );

      expect(await balanceOf(a.id)).toBe(20);
      expect(await balanceOf(b.id)).toBe(0);
    });

    it('recusa transferência para si mesmo', async () => {
      const a = await createUser();
      await walletService.deposit(a.id, { amount: 10 });

      await expect(walletService.transfer(a.id, { toEmail: a.email, amount: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('transferências simultâneas não deixam o saldo negativo (lock)', async () => {
      const a = await createUser();
      const b = await createUser();
      await walletService.deposit(a.id, { amount: 100 });

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => walletService.transfer(a.id, { toEmail: b.email, amount: 30 })),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(3);
      expect(rejected).toHaveLength(2);
      rejected.forEach((r) => expect(r.reason).toBeInstanceOf(UnprocessableEntityException));
      expect(await balanceOf(a.id)).toBe(10);
      expect(await balanceOf(b.id)).toBe(90);
      await expectConsistent(a.id);
      await expectConsistent(b.id);
    });
  });

  describe('estorno', () => {
    it('estorna transferência com movimento inverso e marca a original como REVERSED', async () => {
      const a = await createUser();
      const b = await createUser();
      await walletService.deposit(a.id, { amount: 100 });
      const transfer = await walletService.transfer(a.id, { toEmail: b.email, amount: 30 });

      const reversal = await walletService.reverse(a.id, transfer.id, {});

      expect(reversal.type).toBe('REVERSAL');
      expect(reversal.reversalOfId).toBe(transfer.id);
      expect(reversal.fromWalletId).toBe(transfer.toWalletId);
      expect(reversal.toWalletId).toBe(transfer.fromWalletId);
      const original = await prisma.transaction.findUniqueOrThrow({ where: { id: transfer.id } });
      expect(original.status).toBe('REVERSED');
      expect(await balanceOf(a.id)).toBe(100);
      expect(await balanceOf(b.id)).toBe(0);
      await expectConsistent(a.id);
      await expectConsistent(b.id);
    });

    it('estorna depósito com um único lançamento DEBIT', async () => {
      const a = await createUser();
      const deposit = await walletService.deposit(a.id, { amount: 80 });

      const reversal = await walletService.reverse(a.id, deposit.id, { reason: 'Depósito errado' });

      expect(reversal.toWalletId).toBeNull();
      expect(reversal.entries).toHaveLength(1);
      expect(reversal.entries[0].direction).toBe('DEBIT');
      expect(reversal.description).toBe('Depósito errado');
      expect(await balanceOf(a.id)).toBe(0);
    });

    it('pode deixar o recebedor negativo, e o depósito seguinte soma ao negativo', async () => {
      const a = await createUser();
      const b = await createUser();
      const c = await createUser();
      await walletService.deposit(a.id, { amount: 100 });
      const transfer = await walletService.transfer(a.id, { toEmail: b.email, amount: 100 });
      await walletService.transfer(b.id, { toEmail: c.email, amount: 100 }); // B gasta o que recebeu

      await walletService.reverse(a.id, transfer.id, {});
      expect(await balanceOf(b.id)).toBe(-100);

      await walletService.deposit(b.id, { amount: 30 });
      expect(await balanceOf(b.id)).toBe(-70);
      await expectConsistent(b.id);
    });

    it('não permite estornar a mesma operação duas vezes, nem em paralelo', async () => {
      const a = await createUser();
      const deposit = await walletService.deposit(a.id, { amount: 50 });

      const results = await Promise.allSettled([
        walletService.reverse(a.id, deposit.id, {}),
        walletService.reverse(a.id, deposit.id, {}),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      await expect(walletService.reverse(a.id, deposit.id, {})).rejects.toThrow(ConflictException);
      expect(await balanceOf(a.id)).toBe(0);
    });

    it('não permite estornar um estorno', async () => {
      const a = await createUser();
      const deposit = await walletService.deposit(a.id, { amount: 10 });
      const reversal = await walletService.reverse(a.id, deposit.id, {});

      await expect(walletService.reverse(a.id, reversal.id, {})).rejects.toThrow(BadRequestException);
    });

    it('só quem iniciou a operação pode pedir o estorno', async () => {
      const a = await createUser();
      const b = await createUser();
      await walletService.deposit(a.id, { amount: 40 });
      const transfer = await walletService.transfer(a.id, { toEmail: b.email, amount: 40 });

      await expect(walletService.reverse(b.id, transfer.id, {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('extrato', () => {
    it('mostra entradas, saídas e estornos com a contraparte', async () => {
      const a = await createUser();
      const b = await createUser();
      await walletService.deposit(a.id, { amount: 100 });
      const transfer = await walletService.transfer(a.id, { toEmail: b.email, amount: 30 });
      await walletService.reverse(a.id, transfer.id, {});

      const statement = await walletService.getStatement(a.id, {});

      expect(statement.count).toBe(3);
      const [reversal, sent, deposit] = statement.rows; // mais recentes primeiro
      expect(deposit.transaction.type).toBe('DEPOSIT');
      expect(deposit.transaction.counterpart).toBeNull();
      expect(sent.direction).toBe('DEBIT');
      expect(sent.transaction.status).toBe('REVERSED');
      expect(sent.transaction.counterpart?.email).toBe(b.email);
      expect(reversal.direction).toBe('CREDIT');
      expect(reversal.transaction.type).toBe('REVERSAL');
      expect(reversal.balanceAfter.toNumber()).toBe(100);
    });

    it('canReverse só para quem iniciou, enquanto COMPLETED e fora de estornos', async () => {
      const a = await createUser();
      const b = await createUser();
      await walletService.deposit(a.id, { amount: 100 });
      const transfer = await walletService.transfer(a.id, { toEmail: b.email, amount: 30 });

      const rowOf = async (userId: string, transactionId: string) =>
        (await walletService.getStatement(userId, {})).rows.find((r) => r.transaction.id === transactionId)!;

      expect((await rowOf(a.id, transfer.id)).transaction.canReverse).toBe(true);
      expect((await rowOf(b.id, transfer.id)).transaction.canReverse).toBe(false); // recebedor
      expect((await rowOf(a.id, transfer.id)).transaction).not.toHaveProperty('initiatorId');

      const reversal = await walletService.reverse(a.id, transfer.id, {});
      expect((await rowOf(a.id, transfer.id)).transaction.canReverse).toBe(false); // já estornada
      expect((await rowOf(a.id, reversal.id)).transaction.canReverse).toBe(false); // estorno
    });
  });

  describe('busca de destinatários (search)', () => {
    it('acha por trecho do nome ou do e-mail, sem o próprio usuário', async () => {
      const tag = randomUUID().slice(0, 8);
      const me = await prisma.user.create({
        data: { email: `eu-${tag}@test.com`, password: 'hash', name: `Eu Mesmo ${tag}`, wallet: { create: {} } },
      });
      await prisma.user.create({
        data: { email: `zeca-${tag}@test.com`, password: 'hash', name: `Zeca Pagodinho ${tag}`, wallet: { create: {} } },
      });

      const byName = await userService.searchRecipients(me.id, `pagodinho ${tag}`); // ignora maiúsculas
      expect(byName).toEqual([{ name: `Zeca Pagodinho ${tag}`, email: `zeca-${tag}@test.com` }]);

      const byEmail = await userService.searchRecipients(me.id, `zeca-${tag}`);
      expect(byEmail).toHaveLength(1);

      expect(await userService.searchRecipients(me.id, tag)).toHaveLength(1); // "Eu Mesmo" fica de fora
      expect((await userService.searchRecipients(me.id)).length).toBeLessThanOrEqual(10);
    });
  });

  describe('busca de destinatário (lookup)', () => {
    it('devolve só o nome; recusa o próprio usuário e e-mail inexistente', async () => {
      const a = await createUser();
      const b = await createUser();

      expect(await userService.lookupRecipient(a.id, b.email)).toEqual({ name: 'Usuário de teste' });
      await expect(userService.lookupRecipient(a.id, a.email)).rejects.toThrow(BadRequestException);
      await expect(userService.lookupRecipient(a.id, `nao-existe-${randomUUID()}@test.com`)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
