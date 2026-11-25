import { Navigate, createBrowserRouter } from "react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequerLogin } from "@/features/auth/RequerLogin";
import { BancoAtividadesPage } from "@/features/banco-atividades/BancoAtividadesPage";
import { PrazosPage } from "@/features/prazos/PrazosPage";
import { ConteudoPage } from "@/features/relatorios/ConteudoPage";
import { TurmasPage } from "@/features/turmas/TurmasPage";
import { ProfessoresPage } from "@/features/usuarios/ProfessoresPage";
import { SolicitacoesPage } from "@/features/usuarios/SolicitacoesPage";
import { VisaoGeralPage } from "@/features/visao-geral/VisaoGeralPage";
import { AppShell } from "./AppShell";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequerLogin />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/turmas" replace /> },
          { path: "visao-geral", element: <VisaoGeralPage /> },
          { path: "turmas", element: <TurmasPage /> },
          { path: "professores", element: <ProfessoresPage /> },
          { path: "solicitacoes", element: <SolicitacoesPage /> },
          { path: "prazos", element: <PrazosPage /> },
          { path: "conteudo", element: <ConteudoPage /> },
          { path: "banco", element: <BancoAtividadesPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
