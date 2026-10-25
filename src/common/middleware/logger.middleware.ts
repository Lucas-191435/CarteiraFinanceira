import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';

    // Log no início da requisição
    this.logger.log(`📥 ${method} ${originalUrl} - ${ip} - ${userAgent}`);

    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      const responseTime = Date.now() - startTime;

      // Escolhendo emoji baseado no status code
      let statusEmoji = '✅'; // Sucesso (2xx)
      if (statusCode >= 400 && statusCode < 500) {
        statusEmoji = '⚠️'; // Erro do cliente (4xx)
      } else if (statusCode >= 500) {
        statusEmoji = '❌'; // Erro do servidor (5xx)
      } else if (statusCode >= 300) {
        statusEmoji = '↪️'; // Redirecionamento (3xx)
      }

      // Log ao finalizar a requisição
      this.logger.log(
        `📤 ${statusEmoji} ${statusCode} ${method} ${originalUrl} ${statusCode} ${contentLength ? contentLength + 'bytes' : '-'} - ${responseTime}ms`,
      );
    });

    next();
  }
}
