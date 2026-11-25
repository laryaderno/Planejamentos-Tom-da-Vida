import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "react-router";
import { AuthProvider } from "@/features/auth/AuthContext";
import { persistidor, VALIDADE_CACHE_MS, VERSAO_CACHE } from "@/lib/offline/cache";
import { router } from "./rotas";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Mantém os dados em memória pelo mesmo tempo da cópia local (necessário para restaurá-la).
      gcTime: VALIDADE_CACHE_MS,
      // Sem internet, mostra o que já foi carregado em vez de ficar esperando.
      networkMode: "offlineFirst",
    },
  },
});

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: persistidor,
        maxAge: VALIDADE_CACHE_MS,
        buster: VERSAO_CACHE,
        // Guarda tudo o que já tem dados, mesmo que a última atualização tenha falhado (sem internet).
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.data !== undefined },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
