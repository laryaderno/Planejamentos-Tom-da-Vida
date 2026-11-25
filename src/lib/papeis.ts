/**
 * Papéis e níveis hierárquicos (ARQUITETURA.md §2).
 *
 * Estas funções espelham as regras do banco (`pode_aprovar`, `pode_gerenciar`,
 * `pode_editar_etapa`) apenas para esconder botões e montar opções. Quem decide
 * de verdade é o banco; mantenha os dois em sincronia.
 */
export const PAPEIS = ["administrador", "diretor", "secretaria", "coordenador", "professor"] as const;
export type Papel = (typeof PAPEIS)[number];

export const NIVEL: Record<Papel, number> = {
  administrador: 50,
  diretor: 40,
  secretaria: 30,
  coordenador: 20,
  professor: 10,
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  administrador: "Administrador",
  diretor: "Diretor",
  secretaria: "Secretaria Acadêmica",
  coordenador: "Coordenador",
  professor: "Professor",
};

/** Papéis que alguém pode pedir no cadastro (Administrador nunca). */
export const PAPEIS_SOLICITAVEIS: Papel[] = ["professor", "coordenador", "secretaria", "diretor"];

/** Quem está agindo: papel e etapas que coordena. */
export interface Ator {
  id: string;
  papel: Papel;
  etapasCoordenadas: number[];
}

/** Regra geral: só se altera um usuário de nível estritamente inferior ao seu. */
export function podeGerenciar(ator: Papel, alvo: Papel): boolean {
  return NIVEL[ator] > NIVEL[alvo];
}

/**
 * Trava em cascata (§3.1): uma configuração definida por um nível só pode ser
 * alterada por alguém de nível igual ou superior.
 */
export function podeAlterarConfiguracao(ator: Papel, nivelDefinidor: number): boolean {
  return NIVEL[ator] >= nivelDefinidor;
}

/** Espelho de `public.pode_aprovar` (§4.1). */
export function podeAprovar(ator: Ator, papel: Papel, etapa: number | null): boolean {
  switch (ator.papel) {
    case "administrador":
      return true;
    case "diretor":
      return papel !== "administrador";
    case "secretaria":
      return papel === "coordenador" || papel === "professor";
    case "coordenador":
      return papel === "professor" && etapa !== null && ator.etapasCoordenadas.includes(etapa);
    default:
      return false;
  }
}

/** Papéis que o ator pode atribuir ao aprovar um cadastro. */
export function papeisAprovaveis(ator: Ator): Papel[] {
  return PAPEIS.filter((p) =>
    ator.papel === "coordenador" ? p === "professor" : podeAprovar(ator, p, null),
  );
}

/**
 * Espelho de `public.pode_gerenciar`: alterar permissões ou remover um usuário ativo.
 * `etapasDoAlvo` são as etapas em que o alvo tem vínculo (para o escopo do Coordenador).
 */
export function podeGerenciarUsuario(ator: Ator, alvo: { id: string; papel: Papel }, etapasDoAlvo: number[]): boolean {
  if (alvo.id === ator.id) return false;
  if (ator.papel === "administrador") return true;
  if (!podeGerenciar(ator.papel, alvo.papel)) return false;
  if (ator.papel === "coordenador") return etapasDoAlvo.some((e) => ator.etapasCoordenadas.includes(e));
  return true;
}

/** Espelho de `public.pode_editar_etapa`: cadastrar turmas e vínculos na etapa. */
export function podeEditarEtapa(ator: Ator, etapa: number): boolean {
  return NIVEL[ator.papel] >= NIVEL.secretaria || (ator.papel === "coordenador" && ator.etapasCoordenadas.includes(etapa));
}
