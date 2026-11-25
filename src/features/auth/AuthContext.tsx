import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { verificar } from "@/lib/erros";
import type { Ator, Papel } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type StatusUsuario = Database["public"]["Enums"]["status_usuario"];

export interface Usuario extends Ator {
  nome: string;
  email: string;
  status: StatusUsuario;
}

export interface DadosCadastro {
  nome: string;
  email: string;
  senha: string;
  papel: Papel;
  etapaId: number | null;
}

interface Auth {
  /** Ainda verificando a sessão salva no navegador. */
  carregando: boolean;
  sessao: Session | null;
  usuario: Usuario | null;
  /** Não foi possível carregar o perfil (ex.: sem internet e sem cópia local). */
  erroPerfil: unknown;
  /** O usuário chegou pelo link de redefinição de senha. */
  recuperandoSenha: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: DadosCadastro) => Promise<void>;
  sair: () => Promise<void>;
  enviarRedefinicao: (email: string) => Promise<void>;
  definirNovaSenha: (senha: string) => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

async function carregarUsuario(sessao: Session): Promise<Usuario | null> {
  const resposta = await supabase.from("perfis").select("*").eq("id", sessao.user.id).maybeSingle();
  if (resposta.error) throw resposta.error;
  const perfil = resposta.data;
  if (!perfil) return null;
  let etapasCoordenadas: number[] = [];
  if (perfil.status === "ativo" && perfil.papel === "coordenador") {
    const vinculos = verificar(
      await supabase.from("vinculos").select("etapa_id").eq("usuario_id", perfil.id).eq("ativo", true).is("turma_id", null),
    );
    etapasCoordenadas = vinculos.map((v) => v.etapa_id);
  }
  return {
    id: perfil.id,
    nome: perfil.nome,
    email: perfil.email,
    papel: perfil.papel,
    status: perfil.status,
    etapasCoordenadas,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [sessao, setSessao] = useState<Session | null>(null);
  const [sessaoCarregada, setSessaoCarregada] = useState(false);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setSessaoCarregada(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao);
      if (evento === "PASSWORD_RECOVERY") setRecuperandoSenha(true);
      if (evento === "SIGNED_OUT") qc.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  const perfil = useQuery({
    queryKey: ["eu", sessao?.user.id],
    queryFn: () => carregarUsuario(sessao!),
    enabled: !!sessao,
  });

  const valor: Auth = {
    carregando: !sessaoCarregada || (!!sessao && perfil.isPending),
    sessao,
    usuario: perfil.data ?? null,
    erroPerfil: perfil.data ? null : perfil.error,
    recuperandoSenha,

    async entrar(email, senha) {
      verificar(await supabase.auth.signInWithPassword({ email, password: senha }));
    },

    async cadastrar({ nome, email, senha, papel, etapaId }) {
      verificar(
        await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome, papel_solicitado: papel, etapa_id: etapaId } },
        }),
      );
    },

    async sair() {
      await supabase.auth.signOut();
    },

    async enviarRedefinicao(email) {
      verificar(
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        }),
      );
    },

    async definirNovaSenha(senha) {
      verificar(await supabase.auth.updateUser({ password: senha }));
      setRecuperandoSenha(false);
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

/** Usuário logado e ativo (use dentro das rotas protegidas). */
export function useUsuario(): Usuario {
  const { usuario } = useAuth();
  if (!usuario) throw new Error("useUsuario chamado fora de uma rota protegida");
  return usuario;
}
