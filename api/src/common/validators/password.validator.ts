import { registerDecorator, type ValidationOptions } from 'class-validator';

// Política de senha baseada no NIST SP 800-63B:
// - mínimo 8, máximo 72 (limite do bcrypt; o NIST pede ao menos 64);
// - SEM regras de composição (não exige número, maiúscula nem caractere especial);
// - bloqueia senhas comuns e um único caractere repetido.
// Exceção pedida pelo projeto: sequências (ex.: 12345678) são permitidas.
// Em produção, a lista de senhas comuns seria trocada por uma base de senhas vazadas (ex.: HIBP).
// Mantenha em sincronia com front/src/validations/password.ts.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'passw0rd',
  'senha123',
  'senhasenha',
  'qwertyui',
  'qwerty123',
  'asdfghjk',
  'iloveyou',
  'abc12345',
  'admin123',
  'welcome1',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'dragon12',
  'monkey12',
  'brasil123',
  'carteira',
  'carteira123',
]);

export const isRepeatedCharacter = (password: string) => /^([\s\S])\1*$/u.test(password);
export const isCommonPassword = (password: string) => COMMON_PASSWORDS.has(password.toLowerCase());

/** Rejeita senhas comuns ou formadas por um único caractere repetido. */
export function IsAllowedPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isAllowedPassword',
      target: object.constructor,
      propertyName,
      options: {
        message: 'A senha é muito comum ou repetitiva; escolha outra',
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && !isRepeatedCharacter(value) && !isCommonPassword(value),
      },
    });
  };
}
