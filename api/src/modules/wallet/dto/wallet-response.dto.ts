import { ApiProperty } from '@nestjs/swagger';
import { EntryDirection, TransactionStatus, TransactionType } from 'src/generated/prisma/enums';

// Valores monetários saem como string decimal (ex.: "100.5") para não perder precisão no JSON

export class WalletResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '1000' })
  balance!: string;

  @ApiProperty()
  updatedAt!: Date;
}

export class LedgerEntryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  walletId!: string;

  @ApiProperty()
  transactionId!: string;

  @ApiProperty({ enum: EntryDirection })
  direction!: EntryDirection;

  @ApiProperty({ example: '100.5' })
  amount!: string;

  @ApiProperty({ example: '1100.5', description: 'Saldo da carteira logo após este lançamento' })
  balanceAfter!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class TransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status!: TransactionStatus;

  @ApiProperty({ example: '100.5' })
  amount!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  idempotencyKey!: string | null;

  @ApiProperty()
  initiatorId!: string;

  @ApiProperty({ nullable: true, description: 'null em depósito' })
  fromWalletId!: string | null;

  @ApiProperty({ nullable: true, description: 'null em estorno de depósito' })
  toWalletId!: string | null;

  @ApiProperty({ nullable: true, description: 'Transação original (só em REVERSAL)' })
  reversalOfId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [LedgerEntryResponseDto] })
  entries!: LedgerEntryResponseDto[];
}

class CounterpartDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

class StatementTransactionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status!: TransactionStatus;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  reversalOfId!: string | null;

  @ApiProperty({
    type: CounterpartDto,
    nullable: true,
    description: 'Outro usuário envolvido (null em depósito e estorno de depósito)',
  })
  counterpart!: CounterpartDto | null;

  @ApiProperty({
    description: 'Se o usuário logado pode estornar: ele iniciou, está COMPLETED e não é um estorno',
  })
  canReverse!: boolean;
}

export class StatementEntryDto extends LedgerEntryResponseDto {
  @ApiProperty({ type: StatementTransactionDto })
  transaction!: StatementTransactionDto;
}

export class StatementResponseDto {
  @ApiProperty()
  count!: number;

  @ApiProperty({ type: [StatementEntryDto] })
  rows!: StatementEntryDto[];
}
