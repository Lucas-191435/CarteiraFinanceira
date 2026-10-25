import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('💰 Carteira Financeira API')
    .setDescription(`
    ## 💰 API RESTful desenvolvida por **Lucas-191435** com **NestJS**, **TypeScript** e **Prisma ORM**.

    Carteira financeira em que usuários podem se cadastrar, depositar, transferir saldo e reverter operações.

    ### 📦 Módulos disponíveis
    - 🔐 Auth
    - 👤 User
    - 💳 Wallet (saldo, extrato, depósito, transferência e estorno)

    ### 🔐 Autenticação
    Os endpoints protegidos utilizam autenticação via **Bearer Token (JWT)**.
`)
    .setVersion('1.0')
    .setContact('Lucas-191435', 'https://github.com/Lucas-191435', '')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Swagger UI em /docs/swagger
  SwaggerModule.setup('docs/swagger', app, document, {
    customSiteTitle: 'Carteira Financeira Docs',
    customCss: `.topbar { background-color: #1e293b; }`,
    swaggerOptions: { defaultModelsExpandDepth: -1, persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3333;
  await app.listen(port);

  const url = await app.getUrl();
  const baseUrl = process.env.APP_URL ?? url;

  logger.log('='.repeat(50));
  logger.log(`✅ PRONTO — API rodando em: ${baseUrl}`);
  logger.log(`📚 Swagger: ${baseUrl}/docs/swagger`);
  logger.log('='.repeat(50));
}
void bootstrap();
