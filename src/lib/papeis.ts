/**
 * Papéis e níveis hierárquicos (ARQUITETURA.md §2).
 * Os mesmos valores existem no banco em `public.nivel_papel()`; mantenha os dois em sincronia.
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
