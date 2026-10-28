import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/common/auth/getuser.decorator';
import { WalletService } from './wallet.service';
import {
  DepositDto,
  ReverseTransactionDto,
  StatementQueryDto,
  StatementResponseDto,
  TransactionResponseDto,
  TransferDto,
  WalletResponseDto,
} from './dto';

@ApiTags('wallet')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Saldo atual da carteira do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Carteira encontrada', type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Carteira não encontrada' })
  getWallet(@GetUser('id') userId: string) {
    return this.walletService.getWallet(userId);
  }

  @Get('statement')
  @HttpCode(200)
  @ApiOperation({ summary: 'Extrato paginado (lançamentos da carteira, mais recentes primeiro)' })
  @ApiResponse({ status: 200, description: 'Extrato retornado com sucesso', type: StatementResponseDto })
  getStatement(@GetUser('id') userId: string, @Query() query: StatementQueryDto) {
    return this.walletService.getStatement(userId, query);
  }

  @Post('deposit')
  @HttpCode(201)
  @ApiOperation({ summary: 'Deposita na própria carteira (soma mesmo com saldo negativo)' })
  @ApiResponse({ status: 201, description: 'Depósito realizado', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Valor inválido' })
  @ApiResponse({ status: 409, description: 'idempotencyKey repetida' })
  deposit(@GetUser('id') userId: string, @Body() dto: DepositDto) {
    return this.walletService.deposit(userId, dto);
  }

  @Post('transfer')
  @HttpCode(201)
  @ApiOperation({ summary: 'Transfere saldo para outro usuário (pelo e-mail)' })
  @ApiResponse({ status: 201, description: 'Transferência realizada', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Valor inválido ou transferência para si mesmo' })
  @ApiResponse({ status: 404, description: 'Destinatário não encontrado' })
  @ApiResponse({ status: 409, description: 'idempotencyKey repetida' })
  @ApiResponse({ status: 422, description: 'Saldo insuficiente' })
  transfer(@GetUser('id') userId: string, @Body() dto: TransferDto) {
    return this.walletService.transfer(userId, dto);
  }

  @Post('transactions/:id/reverse')
  @HttpCode(201)
  @ApiOperation({ summary: 'Estorna um depósito ou transferência feito pelo usuário' })
  @ApiResponse({ status: 201, description: 'Estorno realizado', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Um estorno não pode ser revertido' })
  @ApiResponse({ status: 403, description: 'Operação não foi realizada por este usuário' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  @ApiResponse({ status: 409, description: 'Operação já revertida' })
  reverse(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() dto: ReverseTransactionDto,
  ) {
    return this.walletService.reverse(userId, transactionId, dto);
  }
}
