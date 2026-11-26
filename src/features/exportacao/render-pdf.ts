import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import type { Celula, Documento, Paragrafo, Tabela } from "./modelo";

/** Desenha o documento em PDF (pdfmake, carregado só quando alguém exporta). */
export async function gerarPdf(doc: Documento, logo: ArrayBuffer | null): Promise<Blob> {
  const [{ default: pdfMake }, { default: fontes }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fontes);

  const paisagem = doc.orientacao === "paisagem";
  const larguraPagina = paisagem ? 841.89 : 595.28;
  const margem = 24;
  const util = larguraPagina - margem * 2;

  const paragrafo = (p: Paragrafo): Content => ({
    text: p.map((x) => ({ text: compativelComFonte(x.texto), bold: x.negrito, italics: x.italico })),
  });

  const celula = (c: Celula, fundo?: string): TableCell => ({
    stack: c.paragrafos.length ? c.paragrafos.map(paragrafo) : [{ text: "" }],
    colSpan: c.colunas,
    alignment: c.alinhamento === "centro" ? "center" : "left",
    fillColor: fundo,
  });

  const tabela = (tb: Tabela): Content => {
    const soma = tb.larguras.reduce((a, b) => a + b, 0);
    const cabecalho: TableCell[] = tb.cabecalho.map((h) => ({ text: h, bold: true, fillColor: "#F3F4F6", alignment: "center" }));
    const corpo: TableCell[][] = tb.linhas.map((l) => {
      const fundo = l.estilo === "rotina" ? "#F3F2EE" : undefined;
      const celulas: TableCell[] = [];
      for (const c of l.celulas) {
        celulas.push({ ...(celula(c, fundo) as object), bold: l.estilo === "total" } as TableCell);
        // pdfmake exige células vazias no lugar das que foram mescladas
        for (let i = 1; i < (c.colunas ?? 1); i++) celulas.push({});
      }
      return celulas;
    });
    return {
      table: { headerRows: 1, widths: tb.larguras.map((w) => (w / soma) * util - 4), body: [cabecalho, ...corpo] },
      layout: { hLineColor: () => "#9A9A9A", vLineColor: () => "#9A9A9A", hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 2, paddingBottom: () => 2 },
      fontSize: 7.5,
      margin: [0, 0, 0, 10],
    };
  };

  const cabecalho: Content = {
    table: {
      widths: logo ? [56, "*"] : ["*"],
      body: [
        [
          ...(logo ? [{ image: `data:image/png;base64,${paraBase64(logo)}`, width: 50, alignment: "center" as const }] : []),
          {
            stack: [
              { text: doc.titulo, bold: true, fontSize: 13, margin: [0, 2, 0, 4] },
              ...doc.informacoes.map((i) => ({ text: i.rotulo ? [{ text: `${i.rotulo}: `, bold: true }, { text: i.valor }] : [{ text: i.valor, bold: true }], fontSize: 9.5 })),
            ],
          },
        ],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 10],
  };

  const definicao: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: paisagem ? "landscape" : "portrait",
    pageMargins: [margem, margem, margem, 30],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    info: { title: `${doc.titulo} — ${doc.informacoes.map((i) => i.valor).join(" — ")}`, author: "Escola Tom da Vida" },
    content: [
      cabecalho,
      ...doc.blocos.map((b): Content => {
        if (b.tipo === "tabela") return tabela(b);
        if (b.tipo === "titulo") return { text: b.texto, bold: true, fontSize: 11, margin: [0, 6, 0, 4] };
        return { stack: b.paragrafos.map(paragrafo), margin: [0, 0, 0, 8] };
      }),
    ],
    footer: (pagina, total) => ({
      columns: [
        { text: doc.rodape ?? "", fontSize: 7, color: "#666666" },
        { text: `Página ${pagina} de ${total}`, fontSize: 7, color: "#666666", alignment: "right" },
      ],
      margin: [margem, 8, margem, 0],
    }),
  };

  return pdfMake.createPdf(definicao).getBlob();
}

/**
 * A fonte do PDF (Roboto) não tem setas nem emojis: troca por equivalentes
 * em texto para não aparecerem quadradinhos. O Word mantém o original.
 */
export function compativelComFonte(texto: string): string {
  return texto
    .replace(/[→⟶➔➜]/g, "->")
    .replace(/[←⟵]/g, "<-")
    .replace(/[⇒]/g, "=>")
    .replace(/[↑]/g, "^")
    .replace(/[↓]/g, "v")
    .replace(/[✓✔☑]/g, "(ok)")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\u{FE0F}/gu, "");
}

function paraBase64(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
