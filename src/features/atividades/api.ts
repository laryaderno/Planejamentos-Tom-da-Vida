import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/lib/database.types";
import { verificar } from "@/lib/erros";
import { supabase } from "@/lib/supabase";

export type Atividade = Tables<"atividades">;
/** Atividade com a turma e a data do planejamento de origem. */
export type AtividadeComOrigem = Atividade & {
  blocos: { planejamentos: { turma_id: number; data: string } | null } | null;
};

const BUCKET = "atividades";
const MB = 1024 * 1024;

/** Tipos aceitos (espelho de `public.limite_arquivo`). */
export const TIPOS_ARQUIVO: Record<string, { rotulo: string; limite: number; ext: string[] }> = {
  "application/pdf": { rotulo: "PDF", limite: 20 * MB, ext: ["pdf"] },
  "application/msword": { rotulo: "Word", limite: 20 * MB, ext: ["doc"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { rotulo: "Word", limite: 20 * MB, ext: ["docx"] },
  "application/vnd.ms-powerpoint": { rotulo: "Apresentação", limite: 20 * MB, ext: ["ppt"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { rotulo: "Apresentação", limite: 20 * MB, ext: ["pptx"] },
  "application/vnd.ms-excel": { rotulo: "Planilha", limite: 20 * MB, ext: ["xls"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { rotulo: "Planilha", limite: 20 * MB, ext: ["xlsx"] },
  "image/jpeg": { rotulo: "Imagem", limite: 20 * MB, ext: ["jpg", "jpeg"] },
  "image/png": { rotulo: "Imagem", limite: 20 * MB, ext: ["png"] },
  "image/webp": { rotulo: "Imagem", limite: 20 * MB, ext: ["webp"] },
  "audio/mpeg": { rotulo: "Áudio", limite: 50 * MB, ext: ["mp3"] },
  "audio/mp4": { rotulo: "Áudio", limite: 50 * MB, ext: ["m4a"] },
  "video/mp4": { rotulo: "Vídeo", limite: 50 * MB, ext: ["mp4"] },
};

export const ACEITOS = Object.values(TIPOS_ARQUIVO).flatMap((t) => t.ext.map((e) => `.${e}`)).join(",");

/** Tipo do arquivo pelo navegador ou, se vier vazio/diferente, pela extensão. */
export function tipoDoArquivo(nome: string, tipoNavegador: string): string | null {
  if (TIPOS_ARQUIVO[tipoNavegador]) return tipoNavegador;
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  return Object.entries(TIPOS_ARQUIVO).find(([, t]) => t.ext.includes(ext))?.[0] ?? null;
}

/** Nome seguro para o armazenamento: sem acentos nem espaços. */
export function nomeSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function tituloDoArquivo(nome: string): string {
  return nome.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

const SELECT = "*, blocos(planejamentos(turma_id, data))";

export function useAtividadesDoBloco(blocoId: number) {
  return useQuery({
    queryKey: ["atividades", "bloco", blocoId],
    queryFn: async () =>
      verificar(await supabase.from("atividades").select("*").eq("bloco_id", blocoId).order("proposta_em")),
  });
}

/** Todas as atividades que o usuário pode ver (a RLS filtra). */
export function useAtividades() {
  return useQuery({
    queryKey: ["atividades", "todas"],
    queryFn: async () =>
      verificar(await supabase.from("atividades").select(SELECT).order("proposta_em", { ascending: false })) as unknown as AtividadeComOrigem[],
  });
}

/** Envia o arquivo e registra a proposta. Se o registro falhar, apaga o arquivo enviado. */
export async function enviarAtividade(p: { arquivo: File; tipo: string; blocoId: number; professorId: string; titulo: string; tema: string }) {
  const caminho = `${p.professorId}/${crypto.randomUUID()}-${nomeSeguro(p.arquivo.name)}`;
  verificar(await supabase.storage.from(BUCKET).upload(caminho, p.arquivo, { contentType: p.tipo, upsert: false }));
  try {
    verificar(
      await supabase.rpc("propor_atividade", {
        p_bloco: p.blocoId,
        p_titulo: p.titulo,
        p_tema: p.tema,
        p_caminho: caminho,
        p_nome: p.arquivo.name,
        p_tipo: p.tipo,
        p_tamanho: p.arquivo.size,
      }),
    );
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw e;
  }
}

export async function baixarAtividade(a: Pick<Atividade, "arquivo_caminho" | "arquivo_nome">) {
  const { signedUrl } = verificar(
    await supabase.storage.from(BUCKET).createSignedUrl(a.arquivo_caminho, 600, { download: a.arquivo_nome }),
  );
  window.open(signedUrl, "_blank", "noopener");
}

export async function removerAtividade(a: Pick<Atividade, "id" | "arquivo_caminho">) {
  verificar(await supabase.storage.from(BUCKET).remove([a.arquivo_caminho]));
  verificar(await supabase.rpc("remover_atividade", { p_id: a.id }));
}

export const STATUS_ATIVIDADE = {
  pendente: { rotulo: "Aguardando aprovação", cor: "#8A6512", fundo: "#F6E7BF" },
  aprovada: { rotulo: "No banco de atividades", cor: "#3F6136", fundo: "#DDEAD7" },
  recusada: { rotulo: "Não aprovada", cor: "#B24C3B", fundo: "#F7E3DE" },
} as const;
