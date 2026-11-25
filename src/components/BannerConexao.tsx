import { AlertTriangle, CloudUpload, WifiOff } from "lucide-react";
import { useState } from "react";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Modal } from "@/components/Modal";
import { ROTULO_CAMPO } from "@/features/planejamentos/dominio";
import type { Pendencia } from "@/lib/offline/banco-local";
import { descartarPendencia } from "@/lib/offline/fila";
import { useSincronizacao } from "@/lib/offline/SincronizacaoContext";
import { C } from "@/styles/tokens";

const faixa = {
  position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
  flexWrap: "wrap", padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textAlign: "center",
} as const;

/**
 * Aviso persistente de conexão e de alterações guardadas no navegador (§7).
 */
export function BannerConexao() {
  const { online, pendencias } = useSincronizacao();
  const [vendo, setVendo] = useState<Pendencia | null>(null);
  const [descartando, setDescartando] = useState<Pendencia | null>(null);

  const comErro = (pendencias ?? []).filter((p) => p.erro);
  const semErro = (pendencias ?? []).filter((p) => !p.erro);
  const aguardando = semErro.length;
  // Online no computador, mas os envios estão falhando (servidor fora do ar ou rede instável).
  const servidorInacessivel = semErro.some((p) => p.tentativas > 0);

  return (
    <>
      {!online && (
        <div role="alert" style={{ ...faixa, background: C.red, color: "#fff" }}>
          <WifiOff size={16} /> Você está offline. As alterações podem não ter sido salvas.
          <span style={{ fontWeight: 400 }}>
            {aguardando > 0
              ? `${aguardando} ${aguardando === 1 ? "bloco está guardado" : "blocos estão guardados"} neste navegador e ${aguardando === 1 ? "será enviado" : "serão enviados"} quando a conexão voltar.`
              : "O que você digitar fica guardado neste navegador e é enviado quando a conexão voltar."}
          </span>
        </div>
      )}
      {online && aguardando > 0 && servidorInacessivel && (
        <div role="alert" style={{ ...faixa, background: C.red, color: "#fff" }}>
          <WifiOff size={16} /> Sem conexão com o servidor. As alterações podem não ter sido salvas.
          <span style={{ fontWeight: 400 }}>
            {aguardando} {aguardando === 1 ? "bloco está guardado" : "blocos estão guardados"} neste navegador e{" "}
            {aguardando === 1 ? "será enviado" : "serão enviados"} assim que a conexão voltar.
          </span>
        </div>
      )}
      {online && aguardando > 0 && !servidorInacessivel && (
        <div role="status" style={{ ...faixa, background: "#F6E7BF", color: "#8A6512" }}>
          <CloudUpload size={16} /> Enviando {aguardando} {aguardando === 1 ? "alteração guardada" : "alterações guardadas"} neste navegador…
        </div>
      )}
      {comErro.map((p) => (
        <div key={p.chave} role="alert" style={{ ...faixa, background: "#F7E3DE", color: C.red }}>
          <AlertTriangle size={16} /> Uma alteração não pôde ser salva: {p.erro}
          <button className="tv-btn-text" style={{ fontWeight: 600 }} onClick={() => setVendo(p)}>Ver o que foi digitado</button>
          <button className="tv-btn-text-danger" style={{ fontWeight: 600 }} onClick={() => setDescartando(p)}>Descartar</button>
        </div>
      ))}

      {vendo && (
        <Modal titulo="Alteração não salva" subtitulo="Copie o texto abaixo se quiser aproveitá-lo em outro lugar." largura={560} onFechar={() => setVendo(null)}>
          {Object.entries(vendo.campos).map(([campo, valor]) => (
            <div key={campo} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft, margin: "0 0 3px" }}>{ROTULO_CAMPO[campo] ?? campo}</p>
              <p style={{ fontSize: 13.5, margin: 0, whiteSpace: "pre-wrap", userSelect: "text" }}>
                {Array.isArray(valor) ? valor.join(", ") : String(valor ?? "")}
              </p>
            </div>
          ))}
        </Modal>
      )}
      {descartando && (
        <ConfirmarAcao
          titulo="Descartar alteração"
          mensagem="O que foi digitado e não pôde ser salvo será apagado deste navegador."
          irreversivel="Esta ação não pode ser desfeita."
          rotuloConfirmar="Descartar"
          perigo
          onCancelar={() => setDescartando(null)}
          onConfirmar={async () => {
            await descartarPendencia(descartando.chave);
            setDescartando(null);
          }}
        />
      )}
    </>
  );
}
