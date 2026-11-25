import type { LucideIcon } from "lucide-react";
import { Archive, Bell, BookOpen, CalendarDays, GraduationCap, LayoutGrid, Users } from "lucide-react";

export interface ItemNavegacao {
  caminho: string;
  rotulo: string;
  icone: LucideIcon;
}

export const NAVEGACAO: ItemNavegacao[] = [
  { caminho: "/visao-geral", rotulo: "Visão geral", icone: LayoutGrid },
  { caminho: "/turmas", rotulo: "Turmas", icone: GraduationCap },
  { caminho: "/professores", rotulo: "Professores", icone: Users },
  { caminho: "/solicitacoes", rotulo: "Solicitações", icone: Bell },
  { caminho: "/prazos", rotulo: "Prazos e ciclos", icone: CalendarDays },
  { caminho: "/conteudo", rotulo: "Conteúdo programático", icone: BookOpen },
  { caminho: "/banco", rotulo: "Banco de atividades", icone: Archive },
];
