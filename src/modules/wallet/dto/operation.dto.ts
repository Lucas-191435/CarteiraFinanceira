import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';

// Teto técnico por operação; mantém os saldos bem dentro de DECIMAL(15,2)
const MAX_AMOUNT = 1_000_000_000;

export class DepositDto {
  @ApiProperty({ example: 100.5, description: 'Valor em reais, com até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiProperty({ required: false, example: 'Salário', maxLength: 140 })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  description?: string;

  @ApiProperty({
    required: false,
    example: '3f6c2a8e-1b2d-4c5e-9f7a-0b1c2d3e4f5a',
    description: 'Chave única gerada pelo cliente; reenviar a mesma chave não duplica a operação',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}

export class TransferDto extends DepositDto {
  @ApiProperty({ example: 'bruno@carteira.com', description: 'E-mail do destinatário' })
  @IsEmail()
  toEmail!: string;
}
