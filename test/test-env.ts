import 'dotenv/config';

// Os testes de integração usam um banco próprio (<DATABASE_NAME>_test), nunca o de desenvolvimento
const baseName = process.env.DATABASE_NAME ?? 'carteiraFinanceiraBolt';
const testName = baseName.endsWith('_test') ? baseName : `${baseName}_test`;

process.env.DATABASE_NAME = testName;
process.env.DATABASE_URL = (process.env.DATABASE_URL ?? '').replace(/\/[^/?]+(\?|$)/, `/${testName}$1`);

// Mesmo Redis do desenvolvimento, mas com prefixo próprio: o cache dos testes não se mistura com o do dev
process.env.REDIS_KEY_PREFIX = 'test:';
