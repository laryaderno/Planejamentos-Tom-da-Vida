import { describe, expect, it } from "vitest";
import type { Entrega, Periodo } from "@/features/notificacoes/api";
import { periodoDaData, situacaoDoProfessor } from "./atraso";

const periodo = (extra: Partial<Periodo>): Periodo => ({
  id: 1, inicio: "2026-12-07", fim: "2026-12-11", prazo: "2026-12-04", etapa_id: null,
  definido_por_id: null, definido_por_nivel: 0, definido_em: "", ...extra,
});
const entrega = (extra: Partial<Entrega>): Entrega => ({
  id: 1, periodo_id: 1, professor_id: "p", turma_id: 3, entregue_em: "", situacao: "no_prazo", ...extra,
});

describe("etiqueta Atrasado", () => {
  it("escolhe o período da etapa da turma (ou o de todas as etapas)", () => {
    const lista = [periodo({ id: 1, etapa_id: 2 }), periodo({ id: 2, etapa_id: null, inicio: "2026-12-14", fim: "2026-12-18" })];
    expect(periodoDaData(lista, 1, "2026-12-08")).toBeUndefined();
    expect(periodoDaData(lista, 2, "2026-12-08")?.id).toBe(1);
    expect(periodoDaData(lista, 1, "2026-12-15")?.id).toBe(2);
  });

  it("entregue com atraso, não entregue após o prazo e pendente antes do prazo", () => {
    const p = periodo({});
    expect(situacaoDoProfessor(p, [entrega({ situacao: "atrasado" })], "p", 3, "2026-12-10")).toBe("atrasado");
    expect(situacaoDoProfessor(p, [], "p", 3, "2026-12-05")).toBe("nao_entregue");
    expect(situacaoDoProfessor(p, [], "p", 3, "2026-12-04")).toBe("pendente");
    expect(situacaoDoProfessor(p, [entrega({ situacao: "antecipado" })], "p", 3, "2026-12-10")).toBe("antecipado");
  });
});
