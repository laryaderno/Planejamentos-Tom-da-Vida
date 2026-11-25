import { Navigate, Outlet } from "react-router";
import { TelaCarregando } from "@/components/TelaCarregando";
import { useAuth } from "./AuthContext";

/** Rotas internas: exige sessão e perfil ativo. */
export function RequerLogin() {
  const { carregando, sessao, usuario, recuperandoSenha } = useAuth();
  if (carregando) return <TelaCarregando />;
  if (!sessao) return <Navigate to="/login" replace />;
  if (recuperandoSenha) return <Navigate to="/redefinir-senha" replace />;
  if (!usuario || usuario.status !== "ativo") return <Navigate to="/aguardando" replace />;
  return <Outlet />;
}
