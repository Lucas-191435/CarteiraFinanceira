import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import {
  IsAllowedPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from 'src/common/validators/password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Teste123@',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description: 'NIST 800-63B: 8 a 72 caracteres, sem regras de composição; recusa senhas comuns ou de um único caractere repetido',
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres` })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres` })
  @IsAllowedPassword()
  password!: string;

  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
