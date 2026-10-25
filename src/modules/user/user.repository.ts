import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/database/prisma.service';
import { Prisma } from 'src/generated/prisma/client';

const userSafeSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserById = async (id: string) => {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSafeSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  };

  findUserByEmail = async (email: string) => {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });
  };

  /** Busca por nome ou e-mail (a collation do MySQL já ignora maiúsculas e acentos). */
  searchUsers = async ({ query, excludeUserId, take }: { query: string; excludeUserId: string; take: number }) => {
    return this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        ...(query ? { OR: [{ name: { contains: query } }, { email: { contains: query } }] } : {}),
      },
      select: { name: true, email: true },
      orderBy: { name: 'asc' },
      take,
    });
  };

  createUser = async ({ email, password, name }: { email: string; password: string; name: string }) => {
    try {
      // A carteira nasce junto com o usuário (saldo 0)
      return await this.prisma.user.create({
        data: { email, password, name, wallet: { create: {} } },
        select: userSafeSelect,
      });
    } catch (error) {
      // P2002 = violação de unique; garante 409 mesmo com cadastros simultâneos
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com esse e-mail');
      }
      throw error;
    }
  };
}
