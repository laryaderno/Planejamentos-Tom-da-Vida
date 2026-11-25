import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { AuthProvider } from "@/features/auth/AuthContext";
import { DadosPrototipoProvider } from "@/mocks/DadosPrototipoContext";
import { router } from "./rotas";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DadosPrototipoProvider>
          <RouterProvider router={router} />
        </DadosPrototipoProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
