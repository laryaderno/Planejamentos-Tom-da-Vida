// Rotina diária de e-mails (Fase 5, §8.2 e §8.4).
//
// 1. Pede ao banco para preparar a fila do dia (`preparar_envios`): lembretes
//    aos professores e alertas à Coordenação, sem duplicar.
// 2. Envia o que estiver pendente (e tenta de novo, até 3 vezes, o que falhou).
//
// Quem pode chamar: o agendamento diário (cabeçalho `x-segredo-rotina`) ou um
// usuário logado da Direção, Secretaria ou Administração (botão "Enviar agora").
//
// Envio: Resend (RESEND_API_KEY) em produção; Mailpit (MAILPIT_URL) no
// ambiente local; sem nenhum dos dois, só registra como "simulado".
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHAVE_ANONIMA = Deno.env.get("SUPABASE_ANON_KEY")!;
const SEGREDO = Deno.env.get("SEGREDO_ROTINA");
const RESEND = Deno.env.get("RESEND_API_KEY");
const MAILPIT = Deno.env.get("MAILPIT_URL");
const REMETENTE_NOME = Deno.env.get("EMAIL_REMETENTE_NOME") ?? "Escola Tom da Vida";
const REMETENTE_EMAIL = Deno.env.get("EMAIL_REMETENTE") ?? "nao-responda@escolatomdavida.com.br";
const URL_APP = (Deno.env.get("URL_APP") ?? "http://localhost:5173").replace(/\/$/, "");

const LOTE = 100;
const MAX_TENTATIVAS = 3;
const PAPEIS_PERMITIDOS = ["diretor", "secretaria", "administrador"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-segredo-rotina",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Email {
  id: number;
  email: string;
  nome: string;
  assunto: string;
  texto: string;
  link: string | null;
  tentativas: number;
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function html(e: Email): string {
  const link = e.link ? `${URL_APP}${e.link}` : URL_APP;
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F1EEE2;font-family:Arial,Helvetica,sans-serif;color:#1E2A28">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FCFBF6;border:1px solid #DBD5C2;border-radius:10px">
      <tr><td style="padding:22px 26px 6px"><img src="${URL_APP}/logo-tom-da-vida.png" width="64" height="64" alt="Escola Tom da Vida"></td></tr>
      <tr><td style="padding:6px 26px 0"><h1 style="font-size:18px;margin:0 0 12px">${escapar(e.assunto)}</h1></td></tr>
      <tr><td style="padding:0 26px;font-size:14px;line-height:1.6">
        <p style="margin:0 0 12px">Olá, ${escapar(e.nome.split(" ")[0] ?? e.nome)}.</p>
        <p style="margin:0 0 18px">${escapar(e.texto)}</p>
        <p style="margin:0 0 22px"><a href="${escapar(link)}" style="background:#BD8236;color:#fff;text-decoration:none;padding:10px 18px;border-radius:7px;font-weight:bold;display:inline-block">Abrir no sistema</a></p>
      </td></tr>
      <tr><td style="padding:14px 26px 20px;border-top:1px solid #DBD5C2;font-size:12px;color:#54615C">
        Sistema de Planejamento de Aulas — Escola Tom da Vida. Mensagem automática, não responda.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function textoSimples(e: Email): string {
  const link = e.link ? `${URL_APP}${e.link}` : URL_APP;
  return `Olá, ${e.nome.split(" ")[0] ?? e.nome}.\n\n${e.texto}\n\nAbrir no sistema: ${link}\n\n— Escola Tom da Vida (mensagem automática)`;
}

type Resultado = "enviado" | "simulado";

async function enviar(e: Email): Promise<Resultado> {
  if (RESEND) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${REMETENTE_NOME} <${REMETENTE_EMAIL}>`,
        to: [e.email],
        subject: e.assunto,
        html: html(e),
        text: textoSimples(e),
      }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return "enviado";
  }
  if (MAILPIT) {
    const r = await fetch(`${MAILPIT.replace(/\/$/, "")}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: REMETENTE_EMAIL, Name: REMETENTE_NOME },
        To: [{ Email: e.email, Name: e.nome }],
        Subject: e.assunto,
        HTML: html(e),
        Text: textoSimples(e),
      }),
    });
    if (!r.ok) throw new Error(`Mailpit ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return "enviado";
  }
  return "simulado";
}

async function autorizado(req: Request): Promise<{ ok: boolean; viaAgendamento: boolean }> {
  if (SEGREDO && req.headers.get("x-segredo-rotina") === SEGREDO) return { ok: true, viaAgendamento: true };
  const auth = req.headers.get("Authorization");
  if (!auth) return { ok: false, viaAgendamento: false };
  const usuario = createClient(URL_SUPABASE, CHAVE_ANONIMA, { global: { headers: { Authorization: auth } } });
  const { data: papel } = await usuario.rpc("meu_papel");
  return { ok: typeof papel === "string" && PAPEIS_PERMITIDOS.includes(papel), viaAgendamento: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const acesso = await autorizado(req);
  if (!acesso.ok) return json({ erro: "Não autorizado." }, 401);

  // Só o agendamento (ou testes com o segredo) pode simular outro dia.
  let hoje: string | null = null;
  if (acesso.viaAgendamento) {
    const corpo = await req.json().catch(() => ({}));
    if (typeof corpo?.hoje === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.hoje)) hoje = corpo.hoje;
  }

  const servico = createClient(URL_SUPABASE, CHAVE_SERVICO, { auth: { persistSession: false } });

  const preparo = await servico.rpc("preparar_envios", { p_hoje: hoje });
  if (preparo.error) return json({ erro: `Falha ao preparar a fila: ${preparo.error.message}` }, 500);

  const fila = await servico
    .from("emails")
    .select("id, email, nome, assunto, texto, link, tentativas")
    .or(`status.eq.pendente,and(status.eq.erro,tentativas.lt.${MAX_TENTATIVAS})`)
    .order("id")
    .limit(LOTE);
  if (fila.error) return json({ erro: `Falha ao ler a fila: ${fila.error.message}` }, 500);

  const resumo = { preparados: preparo.data as number, enviados: 0, simulados: 0, erros: 0, provedor: RESEND ? "resend" : MAILPIT ? "mailpit" : "simulado" };
  for (const e of fila.data as Email[]) {
    try {
      const resultado = await enviar(e);
      await servico.from("emails").update({ status: resultado, enviado_em: new Date().toISOString(), tentativas: e.tentativas + 1, erro: null }).eq("id", e.id);
      if (resultado === "enviado") resumo.enviados++;
      else resumo.simulados++;
    } catch (erro) {
      await servico.from("emails").update({ status: "erro", tentativas: e.tentativas + 1, erro: String(erro).slice(0, 500) }).eq("id", e.id);
      resumo.erros++;
    }
  }
  return json(resumo);
});
