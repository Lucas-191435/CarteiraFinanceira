import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/common/auth/public.decorator';
import { GetUser } from 'src/common/auth/getuser.decorator';
import { UserService } from './user.service';
import {
  CreateUserDto,
  LookupUserQueryDto,
  LookupUserResponseDto,
  SearchUserQueryDto,
  SearchUserResponseDto,
  UserResponseDto,
} from './dto';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Cadastra um usuário' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso', type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  createUser(@Body() dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado com sucesso', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  me(@GetUser('id') userId: string) {
    return this.userService.findUser(userId);
  }

  // Lista usuários (nome + e-mail) para o select de destinatário. Expõe e-mails de propósito
  // (é o que a tela de transferir mostra); o limite reduz raspagem em massa.
  @ApiBearerAuth()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('search')
  @HttpCode(200)
  @ApiOperation({ summary: 'Busca destinatários por nome ou e-mail (máx. 10, sem o próprio usuário)' })
  @ApiResponse({ status: 200, description: 'Usuários encontrados', type: SearchUserResponseDto, isArray: true })
  search(@GetUser('id') userId: string, @Query() query: SearchUserQueryDto) {
    return this.userService.searchRecipients(userId, query.query);
  }

  // Limite apertado: a rota permite descobrir quais e-mails têm conta (enumeração)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('lookup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nome do destinatário de uma transferência, pelo e-mail' })
  @ApiResponse({ status: 200, description: 'Destinatário encontrado', type: LookupUserResponseDto })
  @ApiResponse({ status: 400, description: 'E-mail inválido ou do próprio usuário' })
  @ApiResponse({ status: 404, description: 'Destinatário não encontrado' })
  lookup(@GetUser('id') userId: string, @Query() query: LookupUserQueryDto) {
    return this.userService.lookupRecipient(userId, query.email);
  }
}
