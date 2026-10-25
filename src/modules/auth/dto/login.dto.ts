import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana@carteira.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Teste123@' })
  // Sem política de tamanho no login: contas criadas antes da regra de 8 caracteres continuam entrando
  @IsString()
  @IsNotEmpty()
  password!: string;
}

class LoginUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;
}

export class LoginResponseDto {
  @ApiProperty({ type: LoginUserDto })
  user!: LoginUserDto;

  @ApiProperty({ description: 'Token JWT de acesso' })
  token!: string;
}
