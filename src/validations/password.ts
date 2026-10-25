// Política de senha baseada no NIST SP 800-63B (a API valida a mesma coisa em
// api/src/common/validators/password.validator.ts — mantenha os dois em sincronia):
// - mínimo 8, máximo 72 (limite do bcrypt);
// - SEM regras de composição (não exige número, maiúscula nem caractere especial);
// - bloqueia senhas comuns e um único caractere repetido;
// - sequências (ex.: 12345678) são permitidas, por decisão do projeto.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "passw0rd",
  "senha123",
  "senhasenha",
  "qwertyui",
  "qwerty123",
  "asdfghjk",
  "iloveyou",
  "abc12345",
  "admin123",
  "welcome1",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "dragon12",
  "monkey12",
  "brasil123",
  "carteira",
  "carteira123",
]);

export const isRepeatedCharacter = (password: string) => /^([\s\S])\1*$/u.test(password);
export const isCommonPassword = (password: string) => COMMON_PASSWORDS.has(password.toLowerCase());

/** Requisitos exibidos no checklist do cadastro, na mesma ordem em que são validados. */
export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    isMet: (password: string) => password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: "repeated",
    label: "Não ser um único caractere repetido",
    isMet: (password: string) => password.length > 0 && !isRepeatedCharacter(password),
  },
  {
    id: "common",
    label: "Não ser uma senha comum, como “password”",
    isMet: (password: string) => password.length > 0 && !isCommonPassword(password),
  },
] as const;
