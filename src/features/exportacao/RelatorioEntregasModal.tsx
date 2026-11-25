import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useUsuario } from "@/features/auth/AuthContext";
import { hojeISO } from "@/features/planejamentos/dominio";
import { useEtapas } from "@/lib/consultas";
import { verificar } from "@/lib/erros";
import { NIVEL } from "@/lib/papeis";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/tokens";
import { BotoesExportar } from "./BotoesExportar";
import { montarRelatorio } from "./relatorios";

/** "Imprimir Relatório" da aba Professores (§9): entregas por professor, em PDF. */
export function RelatorioEntregasModal({ onFechar }: { onFechar: () => void }) {
  const eu = useUsuario();
  const etapas = useEtapas();
  const hoje = hojeISO();
  const [inicio, setInicio] = useState(`${hoje.slice(0, 4)}-01-01`);
  const [fim, setFim] = useState(hoje);
  const escopo =
    NIVEL[eu.papel] >= NIVEL.secretaria
      ? "Escola toda"
      : (etapas.data ?? []).filter((e) => eu.etapasCoordenadas.includes(e.id)).map((e) => e.nome).join(", ");

  return (
    <Modal titulo="Relatório de entregas" subtitulo={`Por professor, em ordem alfabética · ${escopo}`} onFechar={onFechar}>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 12px", lineHeight: 1.5 }}>
        Conta os períodos de entrega com data-limite entre as datas abaixo: com antecedência, no prazo, com atraso e não
        entregues (prazo vencido sem entrega).
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input type="date" className="tv-input" style={{ width: "auto" }} value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="De" />
        <span style={{ color: C.inkSoft }}>a</span>
        <input type="date" className="tv-input" style={{ width: "auto" }} value={fim} onChange={(e) => setFim(e.target.value)} aria-label="Até" />
      </div>
      <BotoesExportar
        formatos={["pdf"]}
        desabilitado={!inicio || !fim || fim < inicio}
        montar={async () =>
          montarRelatorio({
            escopo,
            inicio,
            fim,
            linhas: verificar(await supabase.rpc("relatorio_entregas", { p_inicio: inicio, p_fim: fim })),
            geradoEm: new Date(),
          })
        }
      />
    </Modal>
  );
}
