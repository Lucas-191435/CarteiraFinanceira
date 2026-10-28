import { Prisma } from 'src/generated/prisma/client';

/**
 * O formato que um valor tem depois de JSON.stringify/parse: Decimal e Date viram string.
 * É exatamente o que o cliente HTTP recebe; usar o mesmo formato com e sem cache evita que a
 * resposta mude de tipo conforme veio do banco ou do Redis.
 */
export type Jsonified<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Jsonified<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonified<T[K]> }
        : T;

export const toJson = <T>(value: T): Jsonified<T> => JSON.parse(JSON.stringify(value)) as Jsonified<T>;
