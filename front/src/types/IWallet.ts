// Espelham os DTOs da API (wallet-response.dto.ts).
// Valores monetários chegam como string decimal ("1234.5") e não devem ser convertidos para float.

export type TransactionType = "DEPOSIT" | "TRANSFER" | "REVERSAL";
export type TransactionStatus = "COMPLETED" | "REVERSED";
export type EntryDirection = "CREDIT" | "DEBIT";

// GET /wallet
export interface IWallet {
  id: string;
  balance: string;
  updatedAt: string;
}

// POST /wallet/deposit, /wallet/transfer, /wallet/transactions/:id/reverse
export interface ITransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  description: string | null;
  createdAt: string;
}

// GET /wallet/statement
export interface IStatementEntry {
  id: string;
  walletId: string;
  transactionId: string;
  direction: EntryDirection;
  amount: string;
  balanceAfter: string;
  createdAt: string;
  transaction: {
    id: string;
    type: TransactionType;
    status: TransactionStatus;
    description: string | null;
    reversalOfId: string | null;
    counterpart: { name: string; email: string } | null;
    canReverse: boolean;
  };
}

export interface IStatement {
  count: number;
  rows: IStatementEntry[];
}
