import { execSync } from 'child_process';
import './test-env';

// Aplica as migrations pendentes no banco de teste (não apaga dados; cada teste cria usuários próprios)
export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    env: process.env,
    stdio: 'inherit',
  });
}
