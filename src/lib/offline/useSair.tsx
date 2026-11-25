import { useState } from "react";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAuth } from "@/features/auth/AuthContext";
import { limparCacheLocal } from "./cache";
import { useSincronizacao } from "./SincronizacaoContext";

/**
 * Sair da conta com segurança: se houver alterações ainda não enviadas, avisa
 * antes. Elas ficam guardadas neste navegador (separadas por usuário) e são
 * enviadas quando a pessoa entrar de novo. A cópia local dos dados é apagada.
 */
export function useSair() {
  const { sair } = useAuth();
  const { pendencias, online } = useSincronizacao();
  const [confirmando, setConfirmando] = useState(false);
  const quantas = pendencias?.length ?? 0;

  async function sairDeVez() {
    await limparCacheLocal();
    await sair();
  }

  function pedirSaida() {
    if (quantas > 0) setConfirmando(true);
    else void sairDeVez();
  }

  const modal = confirmando ? (
    <ConfirmarAcao
      titulo="Há alterações ainda não enviadas"
      mensagem={
        <>
          {quantas === 1 ? "Um bloco de planejamento tem" : `${quantas} blocos de planejamento têm`} alterações que ainda não
          chegaram ao servidor{online ? "" : " porque você está sem internet"}. Se sair agora, elas continuam guardadas
          neste navegador e serão enviadas quando você entrar de novo <strong>neste mesmo computador</strong>.
        </>
      }
      rotuloConfirmar="Sair mesmo assim"
      onCancelar={() => setConfirmando(false)}
      onConfirmar={sairDeVez}
    />
  ) : null;

  return { pedirSaida, modal };
}
