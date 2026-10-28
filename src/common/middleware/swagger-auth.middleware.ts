import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Compara em tempo constante: o tempo da resposta não revela quantos caracteres batem. */
const safeEqual = (a: string, b: string) => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

/**
 * HTTP Basic Auth para a documentação (/docs). O navegador mostra a janela de login nativa.
 * Protege só o mapa da API: as rotas continuam exigindo o JWT de qualquer forma.
 */
export function swaggerBasicAuth(user: string, password: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const [scheme, encoded] = (request.headers.authorization ?? '').split(' ');

    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const givenUser = decoded.slice(0, separator);
      const givenPassword = decoded.slice(separator + 1);

      // Os dois sempre comparados (sem curto-circuito), pelo mesmo motivo do safeEqual
      const userOk = separator >= 0 && safeEqual(givenUser, user);
      const passwordOk = separator >= 0 && safeEqual(givenPassword, password);
      if (userOk && passwordOk) {
        return next();
      }
    }

    response.setHeader('WWW-Authenticate', 'Basic realm="Carteira Financeira Docs", charset="UTF-8"');
    response.status(401).send('Credenciais necessárias para acessar a documentação');
  };
}
