"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { IUser } from "@/types/IUser";

// Só os dados do usuário chegam ao client — o token fica no cookie httpOnly, no servidor.
type AuthContextValue = { user: IUser };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ user, children }: { user: IUser; children: ReactNode }) {
  return <AuthContext value={{ user }}>{children}</AuthContext>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  }
  return context;
}
