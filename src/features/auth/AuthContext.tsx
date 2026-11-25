import { createContext, useContext, useState, type ReactNode } from "react";
import type { Papel } from "@/lib/papeis";

/**
 * Sessão do usuário. Por enquanto é simulada (qualquer e-mail/senha entra como
 * Administrador, como no protótipo). Na Fase 1 a implementação passa a usar
 * Supabase Auth + tabela `perfis`, mantendo esta mesma interface.
 */
export interface Usuario {
  nome: string;
  email: string;
  papel: Papel;
}

interface Auth {
  usuario: Usuario | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

function nomeAPartirDoEmail(email: string): string {
  const parte = email.split("@")[0] ?? email;
  return parte.replace(/[.\-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  async function entrar(email: string, _senha: string) {
    setUsuario({ nome: nomeAPartirDoEmail(email), email, papel: "administrador" });
  }

  async function sair() {
    setUsuario(null);
  }

  return <Ctx.Provider value={{ usuario, entrar, sair }}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
