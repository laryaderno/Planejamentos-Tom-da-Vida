import { Clock, ShieldOff } from "lucide-react";
import { Navigate } from "react-router";
import { TelaCarregando } from "@/components/TelaCarregando";
import { ROTULO_PAPEL } from "@/lib/papeis";
import { C } from "@/styles/tokens";
import { useAuth } from "./AuthContext";
import { TelaAuth } from "./TelaAuth";

/** Tela para quem tem login mas ainda não tem acesso (pendente, recusado ou removido). */
export function AguardandoPage() {
  const { carregando, sessao, usuario, sair } = useAuth();

  if (carregando) return <TelaCarregando />;
  if (!sessao) return <Navigate to="/login" replace />;
  if (usuario?.status === "ativo") return <Navigate to="/" replace />;

  const pendente = !usuario || usuario.status === "pendente";
  const Icone = pendente ? Clock : ShieldOff;
  const titulo = pendente
    ? "Cadastro aguardando aprovação"
    : usuario.status === "recusado"
      ? "Cadastro não aprovado"
      : "Acesso removido";
  const texto = pendente
    ? `Seu pedido de acesso${usuario ? ` como ${ROTULO_PAPEL[usuario.papel]}` : ""} foi enviado. Assim que alguém da coordenação ou direção aprovar, você poderá entrar no sistema.`
    : "Se acredita que isso é um engano, procure a Secretaria Acadêmica da escola.";

  return (
    <TelaAuth>
      <div style={{ textAlign: "center" }}>
        <Icone size={28} color={pendente ? C.primary : C.red} />
        <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: "10px 0 8px" }}>{titulo}</p>
        <p style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 20px" }}>{texto}</p>
        {usuario && <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 18px" }}>{usuario.email}</p>}
        <button className="tv-btn tv-btn-secondary" onClick={sair}>Sair</button>
      </div>
    </TelaAuth>
  );
}
