import { STATUS, type StatusBloco } from "./dominio";

export function StatusChip({ status, compacto }: { status: StatusBloco; compacto?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      title={`${s.descricao}: ${s.rotulo}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
        color: s.cor, background: s.fundo, padding: compacto ? "2px 7px" : "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.cor }} />
      {s.rotulo}
    </span>
  );
}
