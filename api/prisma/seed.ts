import prismaClient from './database';
import { seedWalletScenarios } from './seeds/create-wallet-scenarios.seed';

async function main() {
  console.log('🌱 Iniciando seeds do banco de dados...\n');

  await seedWalletScenarios();
  console.log('');
}

(async () => {
  try {
    await main();
    await prismaClient.$disconnect();
    console.log('\n✨ Todos os seeds concluídos com sucesso!');
  } catch (error) {
    console.error('❌ Falha ao executar seeds:', error);
    await prismaClient.$disconnect();
    process.exit(1);
  }
})();
