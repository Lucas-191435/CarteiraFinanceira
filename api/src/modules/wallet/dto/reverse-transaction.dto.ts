import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReverseTransactionDto {
  @ApiProperty({ required: false, example: 'Transferi para a pessoa errada', maxLength: 140 })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  reason?: string;
}
