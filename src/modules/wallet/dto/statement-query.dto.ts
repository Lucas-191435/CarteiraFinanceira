import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class StatementQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiProperty({
    required: false,
    example: '2026-10-01T03:00:00.000Z',
    description: 'Início do período (inclusivo, ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({
    required: false,
    example: '2026-11-01T03:00:00.000Z',
    description: 'Fim do período (exclusivo, ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
