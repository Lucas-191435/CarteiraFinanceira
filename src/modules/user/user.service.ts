import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto';

const RECIPIENT_SEARCH_LIMIT = 10;

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findUser(id: string) {
    return this.userRepository.findUserById(id);
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

  /** Destinatários para o select da transferência: nome + e-mail, sem o próprio usuário. */
  async searchRecipients(userId: string, query?: string) {
    return this.userRepository.searchUsers({
      query: query?.trim() ?? '',
      excludeUserId: userId,
      take: RECIPIENT_SEARCH_LIMIT,
    });
  }

  async createUser(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.userRepository.createUser({
      ...dto,
      password: hashedPassword,
    });
  }
}
