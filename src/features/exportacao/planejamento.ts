import { INTELIGENCIAS, LINGUAGENS_AMOR, type Inteligencia, type LinguagemAmor } from "@/features/planejamentos/dominio";
import { celula, nomeDeArquivo, t, type Celula, type Documento, type Linha, type Paragrafo, type Tabela } from "./modelo";

export type TurnoExport = "matutino" | "vespertino";

export interface BlocoExport {
  hora_inicio: string;
  hora_fim: string;
  disciplina: string;
  conteudo: string;
  objetivos: string;
  habilidades: Inteligencia[];
  estrategias: string;
  atividades: string;
  avaliacao: string;
  recursos: string;
  linguagens_amor: LinguagemAmor[];
}

export interface HorarioExport {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  vigente_desde: string;
  vigente_ate: string | null;
  /** Momento de rotina (Lanche, Saída…) */
  rotulo: string | null;
  /** Aula: nome da disciplina */
  disciplina: string | null;
}

export interface DadosPlanejamento {
  turma: string;
  etapa: string;
  exigeLinguagemAmor: boolean;
  turnoPadrao: TurnoExport;
  inicio: string;
  fim: string;
  planejamentos: { data: string; turno: TurnoExport; blocos: BlocoExport[] }[];
  grade: HorarioExport[];
  diasSemAula: { data: string; descricao: string }[];
  geradoEm: Date;
}

// ---------------------------------------------------------------------------
// Formatação no padrão dos modelos da escola
// ---------------------------------------------------------------------------
const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const TURNO: Record<TurnoExport, string> = { matutino: "Matutino", vespertino: "Vespertino" };

/** "07:30:00" → "7h30"; "08:00" → "8h" */
export function horaModelo(h: string): string {
  const [hh, mm] = h.split(":");
  const horas = String(Number(hh));
  return mm && mm !== "00" ? `${horas}h${mm}` : `${horas}h`;
}

/** "2026-08-24" → "24/08/2026" */
export function dataModelo(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function diaDaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a!, m! - 1, d!).getDay();
}

function somarDia(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const x = new Date(a!, m! - 1, d! + 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function turnoDaHora(h: string): TurnoExport {
  return h < "12:00" ? "matutino" : "vespertino";
}

const ehPolivalente = (disciplina: string) => /polivalente/i.test(disciplina);

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------
const CABECALHO = [
  "Data",
  "Conteúdo",
  "Objetivos de aprendizagem (Habilidades)",
  "Estratégias de Ensino",
  "Atividades propostas",
  "Avaliação",
  "Recursos",
];
const LARGURAS = [9, 13, 16, 17, 17, 14, 12];

type Item =
  | { tipo: "aula"; hora: string; bloco: BlocoExport }
  | { tipo: "rotina"; hora: string; rotulo: string }
  | { tipo: "prevista"; hora: string; disciplina: string };

function campo(texto: string): Paragrafo[] {
  return celula(texto).paragrafos;
}

function celulasDaAula(b: BlocoExport, comLinguagem: boolean): Celula[] {
  const conteudo: Paragrafo[] = [
    ...(ehPolivalente(b.disciplina) ? [] : [[t(b.disciplina, { negrito: true })]]),
    ...campo(b.conteudo),
  ];
  const objetivos: Paragrafo[] = [
    ...(b.habilidades.length
      ? [[t("Múltiplas inteligências:", { negrito: true })], ...b.habilidades.map((h) => [t(INTELIGENCIAS[h])])]
      : []),
    ...campo(b.objetivos),
  ];
  const celulas: Celula[] = [
    { paragrafos: conteudo },
    { paragrafos: objetivos },
    celula(b.estrategias),
    celula(b.atividades),
    celula(b.avaliacao),
    celula(b.recursos),
  ];
  if (comLinguagem) celulas.push({ paragrafos: b.linguagens_amor.map((l) => [t(LINGUAGENS_AMOR[l])]) });
  return celulas;
}

function celulasVazias(primeira: string, colunas: number, italico = false): Celula[] {
  return [celula([[t(primeira, { italico })]]), ...Array.from({ length: colunas - 1 }, () => celula("-", { alinhamento: "centro" }))];
}

/** Planejamento do período no formato dos modelos da escola (uma tabela por dia e turno). */
export function montarPlanejamento(d: DadosPlanejamento): Documento {
  const comLinguagem = d.exigeLinguagemAmor;
  const colunasConteudo = comLinguagem ? 7 : 6;
  const cabecalho = comLinguagem ? [...CABECALHO, "Linguagens do Amor"] : CABECALHO;
  const larguras = comLinguagem ? [8, 12, 15, 15, 15, 13, 11, 11] : LARGURAS;
  const tabelas: Tabela[] = [];

  for (let dia = d.inicio; dia <= d.fim; dia = somarDia(dia)) {
    const dow = diaDaSemana(dia);
    if (dow === 0 || dow === 6) continue;

    const daGrade = d.grade.filter(
      (h) => h.dia_semana === dow && h.vigente_desde <= dia && (h.vigente_ate === null || h.vigente_ate >= dia),
    );
    const planejados = d.planejamentos.filter((p) => p.data === dia);
    const semAula = d.diasSemAula.find((x) => x.data === dia);

    const turnos = new Set<TurnoExport>([
      ...planejados.map((p) => p.turno),
      ...daGrade.map((h) => turnoDaHora(h.hora_inicio)),
    ]);
    if (semAula && turnos.size === 0) turnos.add(d.turnoPadrao);

    for (const turno of (["matutino", "vespertino"] as const).filter((x) => turnos.has(x))) {
      const blocos = planejados.filter((p) => p.turno === turno).flatMap((p) => p.blocos);
      const grade = daGrade.filter((h) => turnoDaHora(h.hora_inicio) === turno);
      const dataCelula = (hora?: string): Paragrafo[] => [
        [t(dataModelo(dia), { negrito: true })],
        [t(TURNO[turno])],
        [t(DIAS[dow]!)],
        ...(hora ? [[t(hora)]] : []),
      ];

      if (semAula && blocos.length === 0) {
        tabelas.push({
          tipo: "tabela",
          larguras,
          cabecalho,
          linhas: [
            {
              celulas: [
                { paragrafos: dataCelula() },
                { paragrafos: [[t(`SEM AULA — ${semAula.descricao}`, { negrito: true })]], colunas: colunasConteudo, alinhamento: "centro" },
              ],
            },
          ],
        });
        continue;
      }

      const itens: Item[] = [
        ...blocos.map((b) => ({ tipo: "aula" as const, hora: b.hora_inicio, bloco: b })),
        ...grade.filter((h) => h.rotulo).map((h) => ({ tipo: "rotina" as const, hora: h.hora_inicio, rotulo: h.rotulo! })),
        // aulas da grade ainda sem planejamento aparecem como nos modelos: só o nome e "-"
        ...grade
          .filter((h) => h.disciplina && !blocos.some((b) => b.disciplina === h.disciplina))
          .map((h) => ({ tipo: "prevista" as const, hora: h.hora_inicio, disciplina: h.disciplina! })),
      ].sort((a, b) => a.hora.localeCompare(b.hora));

      if (itens.length === 0) continue;

      const linhas: Linha[] = itens.map((item, i) => {
        const hora = horaModelo(item.hora);
        const primeira: Celula = { paragrafos: i === 0 ? dataCelula(hora) : [[t(hora)]] };
        if (item.tipo === "aula") return { celulas: [primeira, ...celulasDaAula(item.bloco, comLinguagem)] };
        if (item.tipo === "rotina") {
          return { estilo: "rotina", celulas: [primeira, ...celulasVazias(item.rotulo, colunasConteudo, true)] };
        }
        return { celulas: [primeira, ...celulasVazias(item.disciplina, colunasConteudo)] };
      });

      tabelas.push({ tipo: "tabela", larguras, cabecalho, linhas });
    }
  }

  const periodo = `${dataModelo(d.inicio)} a ${dataModelo(d.fim)}`;
  return {
    nomeArquivo: nomeDeArquivo("Planejamento", d.turma, d.inicio, "a", d.fim),
    orientacao: "paisagem",
    titulo: "PLANEJAMENTO DE AULA",
    informacoes: [
      { rotulo: "TURMA", valor: d.turma.toUpperCase() },
      { rotulo: "ETAPA", valor: d.etapa },
      { rotulo: "PERÍODO", valor: periodo },
    ],
    blocos: tabelas.length
      ? tabelas
      : [{ tipo: "texto", paragrafos: [[t("Nenhum planejamento nem aula da grade neste período.", { italico: true })]] }],
    rodape: `Escola Tom da Vida — gerado em ${d.geradoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
  };
}
