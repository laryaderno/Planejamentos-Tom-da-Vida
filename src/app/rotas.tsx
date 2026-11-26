import { Navigate, createBrowserRouter } from "react-router";
import { AuditoriaPage } from "@/features/admin/AuditoriaPage";
import { AguardandoPage } from "@/features/auth/AguardandoPage";
import { CadastroPage } from "@/features/auth/CadastroPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { PerfilPage } from "@/features/auth/PerfilPage";
import { RequerLogin } from "@/features/auth/RequerLogin";
import { EsqueciSenhaPage, RedefinirSenhaPage } from "@/features/auth/SenhaPages";
import { BancoAtividadesPage } from "@/features/banco-atividades/BancoAtividadesPage";
import { PlanejamentoDiaPage } from "@/features/planejamentos/PlanejamentoDiaPage";
import { PlanejamentosPage } from "@/features/planejamentos/PlanejamentosPage";
import { PrazosPage } from "@/features/prazos/PrazosPage";
import { CronogramaPage } from "@/features/cronograma/CronogramaPage";
import { GradeHorariaPage } from "@/features/grade/GradeHorariaPage";
import { MeusHorariosPage } from "@/features/grade/MeusHorariosPage";
import { NotificacoesPage } from "@/features/notificacoes/NotificacoesPage";
import { TurmasPage } from "@/features/turmas/TurmasPage";
import { EquipeAbasPage } from "@/features/usuarios/EquipeAbasPage";
import { VisaoGeralPage } from "@/features/visao-geral/VisaoGeralPage";
import { AppShell } from "./AppShell";
import { Inicio } from "./Inicio";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/cadastro", element: <CadastroPage /> },
  { path: "/aguardando", element: <AguardandoPage /> },
  { path: "/esqueci-senha", element: <EsqueciSenhaPage /> },
  { path: "/redefinir-senha", element: <RedefinirSenhaPage /> },
  {
    element: <RequerLogin />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Inicio /> },
          { path: "visao-geral", element: <VisaoGeralPage /> },
          { path: "planejamentos", element: <PlanejamentosPage /> },
          { path: "planejamentos/:turma/:data/:turno", element: <PlanejamentoDiaPage /> },
          { path: "grade", element: <GradeHorariaPage /> },
          { path: "meus-horarios", element: <MeusHorariosPage /> },
          { path: "turmas", element: <TurmasPage /> },
          { path: "professores", element: <Navigate to="/equipe" replace /> },
          { path: "equipe", element: <EquipeAbasPage /> },
          { path: "notificacoes", element: <NotificacoesPage /> },
          { path: "solicitacoes", element: <Navigate to="/notificacoes" replace /> },
          { path: "prazos", element: <PrazosPage /> },
          { path: "cronograma", element: <CronogramaPage /> },
          { path: "conteudo", element: <Navigate to="/cronograma" replace /> },
          { path: "banco", element: <BancoAtividadesPage /> },
          { path: "auditoria", element: <AuditoriaPage /> },
          { path: "perfil", element: <PerfilPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
