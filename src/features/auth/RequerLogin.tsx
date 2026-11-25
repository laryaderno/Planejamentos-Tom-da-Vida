import { Navigate, Outlet } from "react-router";
import { TelaCarregando } from "@/components/TelaCarregando";
import { useAuth } from "./AuthContext";

/** Rotas internas: exige sessão e perfil ativo. */
export function RequerLogin() {
  const { carregando, sessao, usuario, erroPerfil, recuperandoSenha } = useAuth();
  if (carregando) return <TelaCarregando />;
  if (!sessao) return <Navigate to="/login" replace />;
  if (!usuario && erroPerfil) {
    return <TelaCarregando texto="Sem conexão com o servidor. Verifique a internet e tente de novo — o que você já digitou continua guardado neste navegador." />;
  }
  if (recuperandoSenha) return <Navigate to="/redefinir-senha" replace />;
  if (!usuario || usuario.status !== "ativo") return <Navigate to="/aguardando" replace />;
  return <Outlet />;
}
