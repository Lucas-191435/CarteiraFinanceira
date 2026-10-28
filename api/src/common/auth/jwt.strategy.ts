import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CacheService, DEFAULT_TTL_SECONDS } from '../cache/cache.service';
import { PrismaService } from '../database/prisma.service';

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  id: string;
}

/** O que fica em request.user: só o id, que é o que as rotas usam (GetUser('id')). Sem hash de senha. */
export type AuthUser = { id: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? '',
    });
  }

  /**
   * Roda em TODA requisição autenticada. A assinatura e a expiração do token o passport-jwt já
   * validou; aqui só confirma que o usuário existe. Em cache por 5 min, senão cada request da API
   * custaria uma consulta ao banco. Usuário inexistente não é cacheado (o loader devolve null).
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const userId = payload.id ?? payload.sub;

    const user = await this.cache.remember(`user:${userId}:auth`, DEFAULT_TTL_SECONDS, () =>
      this.prisma.user.findFirst({ where: { id: userId }, select: { id: true } }),
    );

    if (!user) {
      throw new UnauthorizedException('O token é inválido.');
    }

    return user;
  }
}
