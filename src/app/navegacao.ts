import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  ScrollText,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";
import type { Papel } from "@/lib/papeis";

export interface ItemNavegacao {
  caminho: string;
  rotulo: string;
  icone: LucideIcon;
  /** Papéis que veem o item (matriz de permissões, §3). */
  papeis: Papel[];
}

const GESTAO: Papel[] = ["administrador", "diretor", "secretaria", "coordenador"];
const DIRECAO: Papel[] = ["administrador", "diretor", "secretaria"];

export const NAVEGACAO: ItemNavegacao[] = [
  { caminho: "/visao-geral", rotulo: "Visão geral", icone: LayoutGrid, papeis: GESTAO },
  { caminho: "/turmas", rotulo: "Turmas", icone: GraduationCap, papeis: GESTAO },
  { caminho: "/professores", rotulo: "Professores", icone: Users, papeis: GESTAO },
  { caminho: "/equipe", rotulo: "Equipe", icone: ShieldCheck, papeis: DIRECAO },
  { caminho: "/solicitacoes", rotulo: "Solicitações", icone: Bell, papeis: GESTAO },
  { caminho: "/prazos", rotulo: "Prazos e ciclos", icone: CalendarDays, papeis: ["diretor", "secretaria"] },
  { caminho: "/conteudo", rotulo: "Conteúdo programático", icone: BookOpen, papeis: GESTAO },
  { caminho: "/banco", rotulo: "Banco de atividades", icone: Archive, papeis: [...GESTAO, "professor"] },
  { caminho: "/auditoria", rotulo: "Auditoria", icone: ScrollText, papeis: ["administrador"] },
  { caminho: "/perfil", rotulo: "Meu perfil", icone: UserCircle, papeis: [...GESTAO, "professor"] },
];

export function itensDoPapel(papel: Papel): ItemNavegacao[] {
  return NAVEGACAO.filter((i) => i.papeis.includes(papel));
}

export function podeAcessar(papel: Papel, caminho: string): boolean {
  const item = NAVEGACAO.find((i) => caminho.startsWith(i.caminho));
  return !item || item.papeis.includes(papel);
}
