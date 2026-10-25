import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchUserQueryDto {
  @ApiProperty({ required: false, example: 'bru', description: 'Trecho do nome ou do e-mail; vazio lista os primeiros' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}

export class SearchUserResponseDto {
  @ApiProperty({ example: 'Bruno Lima' })
  name!: string;

  @ApiProperty({ example: 'bruno@carteira.com' })
  email!: string;
}

export class LookupUserQueryDto {
  @ApiProperty({ example: 'bruno@carteira.com', description: 'E-mail do destinatário' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;
}

export class LookupUserResponseDto {
  @ApiProperty({ example: 'Bruno Lima' })
  name!: string;
}
