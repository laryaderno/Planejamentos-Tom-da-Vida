import { Navigate, createBrowserRouter } from "react-router";
import { AuditoriaPage } from "@/features/admin/AuditoriaPage";
import { AguardandoPage } from "@/features/auth/AguardandoPage";
import { CadastroPage } from "@/features/auth/CadastroPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { PerfilPage } from "@/features/auth/PerfilPage";
import { RequerLogin } from "@/features/auth/RequerLogin";
import { EsqueciSenhaPage, RedefinirSenhaPage } from "@/features/auth/SenhaPages";
import { BancoAtividadesPage } from "@/features/banco-atividades/BancoAtividadesPage";
import { PrazosPage } from "@/features/prazos/PrazosPage";
import { ConteudoPage } from "@/features/relatorios/ConteudoPage";
import { TurmasPage } from "@/features/turmas/TurmasPage";
import { EquipePage } from "@/features/usuarios/EquipePage";
import { ProfessoresPage } from "@/features/usuarios/ProfessoresPage";
import { SolicitacoesPage } from "@/features/usuarios/SolicitacoesPage";
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
          { path: "turmas", element: <TurmasPage /> },
          { path: "professores", element: <ProfessoresPage /> },
          { path: "equipe", element: <EquipePage /> },
          { path: "solicitacoes", element: <SolicitacoesPage /> },
          { path: "prazos", element: <PrazosPage /> },
          { path: "conteudo", element: <ConteudoPage /> },
          { path: "banco", element: <BancoAtividadesPage /> },
          { path: "auditoria", element: <AuditoriaPage /> },
          { path: "perfil", element: <PerfilPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
