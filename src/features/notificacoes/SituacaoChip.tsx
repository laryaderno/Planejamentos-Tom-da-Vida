import { SITUACAO, type SituacaoEntrega } from "./api";

export function SituacaoChip({ situacao }: { situacao: SituacaoEntrega }) {
  const s = SITUACAO[situacao];
  return (
    <span style={{ fontSize: 11.5, fontWeight: 600, color: s.cor, background: s.fundo, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {s.rotulo}
    </span>
  );
}
