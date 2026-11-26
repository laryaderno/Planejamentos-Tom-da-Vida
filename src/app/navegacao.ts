import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  ClipboardList,
  CalendarCheck,
  CalendarDays,
  Clock,
  GraduationCap,
  LayoutGrid,
  ScrollText,
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
  /** Mostra o número de notificações não lidas. */
  contador?: boolean;
}

const GESTAO: Papel[] = ["administrador", "diretor", "secretaria", "coordenador"];

export const NAVEGACAO: ItemNavegacao[] = [
  { caminho: "/visao-geral", rotulo: "Visão geral", icone: LayoutGrid, papeis: GESTAO },
  { caminho: "/planejamentos", rotulo: "Planejamentos", icone: CalendarCheck, papeis: [...GESTAO, "professor"] },
  { caminho: "/notificacoes", rotulo: "Notificações", icone: Bell, papeis: [...GESTAO, "professor"], contador: true },
  { caminho: "/meus-horarios", rotulo: "Meus horários", icone: Clock, papeis: ["professor"] },
  { caminho: "/grade", rotulo: "Grade horária", icone: Clock, papeis: GESTAO },
  { caminho: "/turmas", rotulo: "Turmas", icone: GraduationCap, papeis: GESTAO },
  { caminho: "/equipe", rotulo: "Equipe", icone: Users, papeis: GESTAO },
  { caminho: "/prazos", rotulo: "Prazos e ciclos", icone: CalendarDays, papeis: ["diretor", "secretaria"] },
  { caminho: "/cronograma", rotulo: "Cronograma de Avaliação", icone: ClipboardList, papeis: [...GESTAO, "professor"] },
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
