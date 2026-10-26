import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Jsonified, toJson } from './jsonified';

export const REDIS_URL = 'REDIS_URL';

/** TTL padrão das leituras cacheadas (5 min por usuário). */
export const DEFAULT_TTL_SECONDS = 300;

/**
 * Cache em Redis tolerante a falha: nenhum erro do Redis chega à requisição. Se ele estiver fora
 * (ou sem REDIS_URL), toda leitura vai direto ao banco — fica mais lento, nada quebra.
 *
 * Regra do projeto: o cache serve só para EXIBIR. Validação de saldo e qualquer leitura dentro de
 * transação nunca passam por aqui.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis | null;
  private readonly prefix = process.env.REDIS_KEY_PREFIX ?? '';
  private down = false;

  /** `null` desliga o cache (ex.: seed); sem argumento, usa REDIS_URL do ambiente. */
  constructor(@Optional() @Inject(REDIS_URL) url?: string | null) {
    const redisUrl = url === undefined ? process.env.REDIS_URL : url;
    this.client = redisUrl ? this.connect(redisUrl) : null;
    if (!this.client) {
      this.logger.log('REDIS_URL ausente: cache desligado, leituras direto no banco');
    }
  }

  get available() {
    return this.client?.status === 'ready';
  }

  /** Espera a conexão ficar pronta (útil em testes e no boot). */
  async waitUntilReady(timeoutMs = 2000): Promise<boolean> {
    if (!this.client) return false;
    if (this.available) return true;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(this.available), timeoutMs);
      this.client!.once('ready', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.available) return null;
    try {
      const raw = await this.client!.get(this.prefix + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    if (!this.available) return;
    try {
      await this.client!.set(this.prefix + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // cache é opcional: falha ao gravar só significa que a próxima leitura vai ao banco
    }
  }

  /**
   * Lê do cache; se não tiver, chama o loader, grava e devolve. O resultado tem sempre o formato
   * JSON (Decimal e Date como string), venha do banco ou do Redis.
   */
  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<Jsonified<T>> {
    const cached = await this.getJson<Jsonified<T>>(key);
    if (cached !== null) return cached;

    const value = toJson(await loader());
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  /** Versão atual da carteira; entra na chave do saldo e do extrato (0 se nunca mudou). */
  async walletVersion(walletId: string): Promise<number> {
    if (!this.available) return 0;
    try {
      return Number(await this.client!.get(this.walletVersionKey(walletId))) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Invalida saldo e extrato das carteiras: incrementa a versão, e as chaves antigas deixam de ser
   * lidas na hora (expiram sozinhas pelo TTL). Chamar DEPOIS do commit da transação.
   */
  async bumpWallets(...walletIds: (string | null | undefined)[]): Promise<void> {
    const ids = [...new Set(walletIds.filter((id): id is string => !!id))];
    if (!this.available || ids.length === 0) return;
    try {
      const pipeline = this.client!.pipeline();
      for (const id of ids) {
        pipeline.incr(this.walletVersionKey(id));
      }
      await pipeline.exec();
    } catch (error) {
      // Sem bump, o cache antigo vale até o TTL (5 min). Não falha a operação, que já foi gravada.
      this.logger.warn(`Falha ao invalidar carteiras ${ids.join(', ')}: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    if (this.available) {
      await this.client.quit().catch(() => undefined);
    } else {
      // Fora do ar, quit() esperaria uma conexão que não vem; disconnect() também para a reconexão,
      // que senão seguraria o processo aberto (ex.: o Jest não termina)
      this.client.disconnect();
    }
  }

  // O contador não expira: se sumisse, voltaria a 0 e poderia reaproveitar uma chave "v0" ainda viva
  private walletVersionKey(walletId: string) {
    return `${this.prefix}wallet:${walletId}:v`;
  }

  private connect(url: string) {
    const client = new Redis(url, {
      // Falha rápido em vez de enfileirar comandos ou segurar a requisição esperando o Redis
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      // Continua tentando reconectar em segundo plano
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });

    // Loga só na mudança de estado (cair/voltar), sem inundar o log a cada tentativa
    client.on('error', (error) => {
      if (!this.down) {
        this.down = true;
        this.logger.warn(`Redis indisponível, leituras direto no banco: ${error.message}`);
      }
    });
    client.on('ready', () => {
      if (this.down) this.logger.log('Redis de volta: cache reativado');
      this.down = false;
    });

    return client;
  }
}
