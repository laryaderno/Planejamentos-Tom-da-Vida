import { Navigate } from "react-router";
import { useUsuario } from "@/features/auth/AuthContext";
import { itensDoPapel } from "./navegacao";

/** Página inicial: a primeira do menu do papel. */
export function Inicio() {
  const eu = useUsuario();
  return <Navigate to={itensDoPapel(eu.papel)[0]?.caminho ?? "/banco"} replace />;
}
