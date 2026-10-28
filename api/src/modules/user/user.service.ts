import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { CacheService, DEFAULT_TTL_SECONDS } from 'src/common/cache/cache.service';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto';

const RECIPIENT_SEARCH_LIMIT = 10;

/** Usuários novos aparecem na busca em até 1 min. */
const SEARCH_TTL_SECONDS = 60;

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cache: CacheService,
  ) {}

  /**
   * GET /user/me, chamado em toda página do front. Sem invalidação: não há rota que altere nome ou
   * e-mail. Usuário inexistente lança 404 e não entra no cache.
   */
  async findUser(id: string) {
    return this.cache.remember(`user:${id}:me`, DEFAULT_TTL_SECONDS, () => this.userRepository.findUserById(id));
  }

  /**
   * Nome do destinatário para o front confirmar a transferência antes de enviar.
   * Devolve só o nome (nada de id/e-mail). A transferência continua validando tudo por conta própria.
   */
  async lookupRecipient(userId: string, email: string) {
    const user = await this.userRepository.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('Destinatário não encontrado');
    }
    if (user.id === userId) {
      throw new BadRequestException('Não é possível transferir para si mesmo');
    }

    return { name: user.name };
  }

  /**
   * Destinatários para o select da transferência: nome + e-mail, sem o próprio usuário.
   * A chave inclui quem busca, porque o resultado exclui o próprio usuário.
   */
  async searchRecipients(userId: string, query?: string) {
    // A collation do MySQL já ignora maiúsculas: "Bru" e "bru" são a mesma busca e a mesma chave
    const term = query?.trim().toLowerCase() ?? '';

    return this.cache.remember(`search:${userId}:${term}`, SEARCH_TTL_SECONDS, () =>
      this.userRepository.searchUsers({ query: term, excludeUserId: userId, take: RECIPIENT_SEARCH_LIMIT }),
    );
  }

  async createUser(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.userRepository.createUser({
      ...dto,
      password: hashedPassword,
    });
  }
}
