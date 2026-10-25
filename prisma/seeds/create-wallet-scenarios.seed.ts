import bcrypt from 'bcrypt';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import prismaClient from '../database';
import { PrismaService } from 'src/common/database/prisma.service';
import { WalletRepository } from 'src/modules/wallet/wallet.repository';
import { WalletService } from 'src/modules/wallet/wallet.service';

// Para executar manualmente: npx prisma db seed
// Ou individualmente: npx tsx prisma/seeds/create-wallet-scenarios.seed.ts
//
// Cria 6 usuários e um histórico de jun–out/2026 passando pelo próprio WalletService,
// então toda operação respeita as regras da API (lock, validação de saldo, ledger, estorno).
// Depois de cada operação a data é ajustada para espalhar o histórico pelos meses.

const PASSWORD = 'Teste123@';

const USERS = {
  ana: { email: 'ana@carteira.com', name: 'Ana Souza' }, // salário fixo, paga aluguel, empresta dinheiro
  bruno: { email: 'bruno@carteira.com', name: 'Bruno Lima' }, // recebe aluguéis, paga serviços
  carla: { email: 'carla@carteira.com', name: 'Carla Mendes' }, // fica negativa após um estorno
  diego: { email: 'diego@carteira.com', name: 'Diego Rocha' }, // transfere para a pessoa errada e estorna
  elisa: { email: 'elisa@carteira.com', name: 'Elisa Martins' }, // freelancer, deposita valor errado e estorna
  fabio: { email: 'fabio@carteira.com', name: 'Fábio Costa' }, // termina o período com saldo negativo
} as const;

type UserKey = keyof typeof USERS;

const walletService = new WalletService(new WalletRepository(prismaClient as unknown as PrismaService));

const userIds = {} as Record<UserKey, string>;
const refs: Record<string, string> = {}; // ids de transações que serão estornadas depois

// Horário de Brasília
const at = (dateTime: string) => new Date(`${dateTime}-03:00`);

const backdate = async (transactionId: string, date: Date) => {
  await prismaClient.$transaction([
    prismaClient.transaction.update({ where: { id: transactionId }, data: { createdAt: date } }),
    prismaClient.ledgerEntry.updateMany({ where: { transactionId }, data: { createdAt: date } }),
  ]);
};

const deposit = async (who: UserKey, amount: number, description: string, date: Date, idempotencyKey?: string) => {
  const transaction = await walletService.deposit(userIds[who], { amount, description, idempotencyKey });
  await backdate(transaction.id, date);
  return transaction.id;
};

const transfer = async (from: UserKey, to: UserKey, amount: number, description: string, date: Date) => {
  const transaction = await walletService.transfer(userIds[from], {
    toEmail: USERS[to].email,
    amount,
    description,
  });
  await backdate(transaction.id, date);
  return transaction.id;
};

const reverse = async (who: UserKey, transactionId: string, reason: string, date: Date) => {
  const transaction = await walletService.reverse(userIds[who], transactionId, { reason });
  await backdate(transaction.id, date);
  return transaction.id;
};

const balanceOf = async (who: UserKey) => {
  const wallet = await prismaClient.wallet.findUniqueOrThrow({ where: { userId: userIds[who] } });
  return wallet.balance.toNumber();
};

type Step = { date: string; run: (date: Date) => Promise<unknown> };

/** Rotina que se repete todo mês: salários/receitas, aluguéis e pagamentos entre os usuários. */
const monthlyRoutine = (month: string, label: string, partial = false): Step[] => {
  const d = (day: string, time: string) => `${month}-${day}T${time}`;

  const steps: Step[] = [
    { date: d('05', '09:00:00'), run: (t) => deposit('ana', 5000, `Salário ${label}`, t) },
    { date: d('05', '09:05:00'), run: (t) => deposit('bruno', 3000, `Pró-labore ${label}`, t) },
    { date: d('05', '09:10:00'), run: (t) => deposit('carla', 1500, `Bolsa de estágio ${label}`, t) },
    { date: d('05', '09:15:00'), run: (t) => deposit('diego', 2500, `Salário ${label}`, t) },
    { date: d('05', '09:20:00'), run: (t) => deposit('elisa', 1200, `Projeto freelance ${label}`, t) },
    { date: d('05', '09:25:00'), run: (t) => deposit('fabio', 600, `Mesada ${label}`, t) },
    { date: d('08', '10:00:00'), run: (t) => transfer('ana', 'bruno', 1800, `Aluguel ${label}`, t) },
    { date: d('10', '11:30:00'), run: (t) => transfer('diego', 'bruno', 1500, `Aluguel ${label}`, t) },
    { date: d('12', '19:45:00'), run: (t) => transfer('elisa', 'ana', 150, `Rateio da internet ${label}`, t) },
    {
      date: d('15', '14:00:00'),
      run: async (t) => {
        refs[`bruno-fabio-${month}`] = await transfer('bruno', 'fabio', 300, `Serviço de jardinagem ${label}`, t);
      },
    },
    { date: d('18', '12:20:00'), run: (t) => transfer('carla', 'elisa', 200, `Aula particular ${label}`, t) },
    { date: d('20', '20:10:00'), run: (t) => transfer('fabio', 'diego', 80, `Pizza dividida ${label}`, t) },
  ];

  if (!partial) {
    steps.push(
      { date: d('22', '09:40:00'), run: (t) => transfer('ana', 'carla', 250, `Ajuda com o transporte ${label}`, t) },
      { date: d('25', '16:00:00'), run: (t) => transfer('diego', 'elisa', 400, `Design do site ${label}`, t) },
      { date: d('27', '10:30:00'), run: (t) => deposit('elisa', 800, `Projeto freelance extra ${label}`, t) },
    );
  }

  return steps;
};

/** Cenários pontuais (estornos, saldo negativo, tentativas recusadas). */
const specialScenarios: Step[] = [
  // Ago: Diego transfere para a pessoa errada e estorna no mesmo dia
  {
    date: '2026-08-26T15:00:00',
    run: async (t) => {
      refs.diegoWrong = await transfer('diego', 'carla', 700, 'Pagamento do freela (destinatário errado)', t);
    },
  },
  {
    date: '2026-08-26T15:12:00',
    run: (t) => reverse('diego', refs.diegoWrong, 'Transferi para a pessoa errada', t),
  },
  { date: '2026-08-26T15:20:00', run: (t) => transfer('diego', 'elisa', 700, 'Pagamento do freela', t) },

  // Set: Ana empresta para Carla, Carla gasta, Ana contesta → Carla fica negativa; o depósito do dia 5 soma ao negativo
  {
    date: '2026-09-02T08:30:00',
    run: async (t) => {
      refs.anaLoan = await transfer('ana', 'carla', 1200, 'Empréstimo', t);
    },
  },
  {
    date: '2026-09-03T13:00:00',
    run: async (t) => transfer('carla', 'bruno', (await balanceOf('carla')) - 300, 'Compra do notebook', t),
  },
  {
    date: '2026-09-04T09:00:00',
    run: (t) => reverse('ana', refs.anaLoan, 'Transferência contestada', t),
  },

  // Set: Elisa digita o valor errado no depósito, estorna e deposita o valor certo
  {
    date: '2026-09-06T10:00:00',
    run: async (t) => {
      refs.elisaWrong = await deposit('elisa', 5000, 'Depósito (valor digitado errado)', t);
    },
  },
  {
    date: '2026-09-06T10:03:00',
    run: (t) => reverse('elisa', refs.elisaWrong, 'Digitei 5000 em vez de 500', t),
  },
  { date: '2026-09-06T10:05:00', run: (t) => deposit('elisa', 500, 'Depósito', t) },

  // Out: Bruno envia o pagamento em duplicidade e estorna a cópia
  {
    date: '2026-10-15T14:01:00',
    run: async (t) => {
      refs.brunoDup = await transfer('bruno', 'fabio', 300, 'Serviço de jardinagem out/26 (duplicado)', t);
    },
  },
  {
    date: '2026-10-16T09:00:00',
    run: (t) => reverse('bruno', refs.brunoDup, 'Pagamento enviado em duplicidade', t),
  },

  // Out: tentativa de transferência sem saldo (recusada, não gera transação)
  {
    date: '2026-10-21T18:00:00',
    run: async () => {
      try {
        await walletService.transfer(userIds.fabio, { toEmail: USERS.bruno.email, amount: 50000 });
      } catch (error) {
        if (!(error instanceof UnprocessableEntityException)) throw error;
        console.log('   ↳ Tentativa de transferência sem saldo recusada (esperado)');
      }
    },
  },

  // Out: depósito reenviado com a mesma idempotencyKey (recusado, não duplica)
  {
    date: '2026-10-21T18:30:00',
    run: async (t) => {
      const key = 'seed-ana-bonus-out26';
      await deposit('ana', 700, 'Bônus de desempenho', t, key);
      try {
        await walletService.deposit(userIds.ana, { amount: 700, description: 'Bônus de desempenho', idempotencyKey: key });
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        console.log('   ↳ Depósito com idempotencyKey repetida recusado (esperado)');
      }
    },
  },

  // Out: Fábio gasta quase tudo e Bruno estorna o serviço do mês → Fábio termina negativo
  {
    date: '2026-10-22T11:00:00',
    run: async (t) => transfer('fabio', 'elisa', (await balanceOf('fabio')) - 100, 'Curso de fotografia', t),
  },
  {
    date: '2026-10-23T17:00:00',
    run: (t) => reverse('bruno', refs['bruno-fabio-2026-10'], 'Serviço não foi prestado', t),
  },
];

export const seedWalletScenarios = async () => {
  const alreadySeeded = await prismaClient.user.findUnique({ where: { email: USERS.ana.email } });
  if (alreadySeeded) {
    console.log('⏭️  Cenários da carteira já existem, pulando.');
    return;
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  for (const [key, { email, name }] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const user = await prismaClient.user.create({
      data: { email, name, password: hashedPassword, wallet: { create: {} } },
    });
    userIds[key] = user.id;
  }

  const timeline: Step[] = [
    ...monthlyRoutine('2026-06', 'jun/26'),
    ...monthlyRoutine('2026-07', 'jul/26'),
    ...monthlyRoutine('2026-08', 'ago/26'),
    ...monthlyRoutine('2026-09', 'set/26'),
    ...monthlyRoutine('2026-10', 'out/26', true),
    ...specialScenarios,
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Em ordem cronológica, para o balanceAfter acompanhar as datas
  for (const step of timeline) {
    await step.run(at(step.date));
  }

  console.log(`✅ Cenários da carteira criados (senha de todos: ${PASSWORD}):`);
  for (const [key, { email, name }] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const wallet = await prismaClient.wallet.findUniqueOrThrow({
      where: { userId: userIds[key] },
      include: { _count: { select: { entries: true } } },
    });
    console.log(
      `   ${name.padEnd(14)} ${email.padEnd(20)} saldo ${wallet.balance.toFixed(2).padStart(9)}  lançamentos ${wallet._count.entries}`,
    );
  }
};
