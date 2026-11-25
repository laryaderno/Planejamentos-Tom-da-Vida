import type { Documento } from "./modelo";

let logoEmCache: ArrayBuffer | null | undefined;

/** Logotipo oficial (public/logo-tom-da-vida.png). Sem ele, o arquivo sai sem logo. */
async function carregarLogo(): Promise<ArrayBuffer | null> {
  if (logoEmCache !== undefined) return logoEmCache;
  try {
    const r = await fetch("/logo-tom-da-vida.png");
    logoEmCache = r.ok ? await r.arrayBuffer() : null;
  } catch {
    logoEmCache = null;
  }
  return logoEmCache;
}

function salvar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type Formato = "pdf" | "docx";

/** Gera e baixa o documento no formato escolhido. */
export async function exportar(doc: Documento, formato: Formato): Promise<void> {
  const logo = await carregarLogo();
  if (formato === "pdf") {
    const { gerarPdf } = await import("./render-pdf");
    salvar(await gerarPdf(doc, logo), `${doc.nomeArquivo}.pdf`);
  } else {
    const { gerarDocx } = await import("./render-docx");
    salvar(await gerarDocx(doc, logo), `${doc.nomeArquivo}.docx`);
  }
}
