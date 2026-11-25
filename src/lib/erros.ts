/**
 * Converte erros do Supabase em mensagens para o usuário.
 * As funções do banco já devolvem mensagens em português (ex.: a da trava em cascata).
 */
export function mensagemDeErro(erro: unknown): string {
  if (erro && typeof erro === "object" && "message" in erro && typeof erro.message === "string") {
    const msg = erro.message;
    if (msg === "Invalid login credentials") return "E-mail ou senha incorretos.";
    if (msg === "User already registered") return "Já existe um cadastro com este e-mail.";
    if (msg.startsWith("Password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
    if (msg === "Failed to fetch") return "Sem conexão com o servidor. Verifique sua internet.";
    return msg;
  }
  return "Algo deu errado. Tente novamente.";
}

/**
 * Lança o erro de uma resposta do Supabase, se houver, e devolve os dados.
 * Não use com `.maybeSingle()`, em que `null` é um resultado válido.
 */
export function verificar<R extends { data: unknown; error: unknown }>(resposta: R): NonNullable<R["data"]> {
  if (resposta.error) throw resposta.error;
  return resposta.data as NonNullable<R["data"]>;
}
