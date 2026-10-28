import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: '💰 Carteira Financeira API',
      author: 'Lucas-191435',
      status: 'online',
      docs: '/docs/swagger',
      database: 'MySQL + Prisma',
      timestamp: new Date().toISOString(),
    };
  }
}
