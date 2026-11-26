import type { Celula, Documento, Paragrafo, Tabela } from "./modelo";

/** Desenha o documento em Word (.docx), no padrão dos modelos: Arial 9, A4. */
export async function gerarDocx(doc: Documento, logo: ArrayBuffer | null): Promise<Blob> {
  const d = await import("docx");
  const {
    AlignmentType, BorderStyle, Document, Footer, ImageRun, Packer, PageNumber, PageOrientation,
    Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, convertMillimetersToTwip,
  } = d;

  const paisagem = doc.orientacao === "paisagem";
  const margem = convertMillimetersToTwip(10);
  const larguraUtil = convertMillimetersToTwip(paisagem ? 297 : 210) - margem * 2;
  const FONTE = "Arial";
  const borda = { style: BorderStyle.SINGLE, size: 4, color: "9A9A9A" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };

  const paragrafo = (p: Paragrafo, tamanho = 16, alinhamento?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new Paragraph({
      alignment: alinhamento,
      children: p.map((x) => new TextRun({ text: x.texto, bold: x.negrito, italics: x.italico, font: FONTE, size: tamanho })),
    });

  const celula = (c: Celula, largura: number, fundo?: string, negrito = false) =>
    new TableCell({
      columnSpan: c.colunas,
      width: { size: largura, type: WidthType.DXA },
      borders: bordas,
      shading: fundo ? { type: ShadingType.CLEAR, color: "auto", fill: fundo } : undefined,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      children: (c.paragrafos.length ? c.paragrafos : [[{ texto: "" }]]).map((p) =>
        paragrafo(negrito ? p.map((x) => ({ ...x, negrito: true })) : p, 16, c.alinhamento === "centro" ? AlignmentType.CENTER : undefined),
      ),
    });

  const tabela = (tb: Tabela) => {
    const soma = tb.larguras.reduce((a, b) => a + b, 0);
    const colunas = tb.larguras.map((w) => Math.floor((w / soma) * larguraUtil));
    const cabecalho = new TableRow({
      tableHeader: true,
      children: tb.cabecalho.map(
        (h, i) =>
          new TableCell({
            width: { size: colunas[i]!, type: WidthType.DXA },
            borders: bordas,
            shading: { type: ShadingType.CLEAR, color: "auto", fill: "EFEAD9" },
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [paragrafo([{ texto: h, negrito: true }], 16, AlignmentType.CENTER)],
          }),
      ),
    });
    const linhas = tb.linhas.map((l) => {
      let col = 0;
      return new TableRow({
        cantSplit: false,
        children: l.celulas.map((c) => {
          const span = c.colunas ?? 1;
          const largura = colunas.slice(col, col + span).reduce((a, b) => a + b, 0);
          col += span;
          return celula(c, largura, l.estilo === "rotina" ? "F3F2EE" : undefined, l.estilo === "total");
        }),
      });
    });
    return new Table({ width: { size: larguraUtil, type: WidthType.DXA }, columnWidths: colunas, rows: [cabecalho, ...linhas] });
  };

  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const larguraLogo = convertMillimetersToTwip(22);
  const cabecalho = new Table({
    width: { size: larguraUtil, type: WidthType.DXA },
    columnWidths: logo ? [larguraLogo, larguraUtil - larguraLogo] : [larguraUtil],
    borders: { ...semBordas, insideHorizontal: semBorda, insideVertical: semBorda },
    rows: [
      new TableRow({
        children: [
          ...(logo
            ? [
                new TableCell({
                  width: { size: larguraLogo, type: WidthType.DXA },
                  borders: semBordas,
                  children: [new Paragraph({ children: [new ImageRun({ type: "png", data: logo, transformation: { width: 64, height: 64 } })] })],
                }),
              ]
            : []),
          new TableCell({
            borders: semBordas,
            children: [
              paragrafo([{ texto: doc.titulo, negrito: true }], 26),
              ...doc.informacoes.map((i) => paragrafo(i.rotulo ? [{ texto: `${i.rotulo}: `, negrito: true }, { texto: i.valor }] : [{ texto: i.valor, negrito: true }], 20)),
            ],
          }),
        ],
      }),
    ],
  });

  const espaco = () => new Paragraph({ children: [new TextRun({ text: "", size: 8 })] });

  const documento = new Document({
    creator: "Escola Tom da Vida",
    title: `${doc.titulo} — ${doc.informacoes.map((i) => i.valor).join(" — ")}`,
    styles: { default: { document: { run: { font: FONTE, size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: paisagem ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: { top: margem, bottom: margem, left: margem, right: margem },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${doc.rodape ?? ""}   ·   Página `, font: FONTE, size: 14, color: "666666" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 14, color: "666666" }),
                  new TextRun({ text: " de ", font: FONTE, size: 14, color: "666666" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONTE, size: 14, color: "666666" }),
                ],
              }),
            ],
          }),
        },
        children: [
          cabecalho,
          espaco(),
          ...doc.blocos.flatMap((b) => {
            if (b.tipo === "tabela") return [tabela(b), espaco()];
            if (b.tipo === "titulo") return [paragrafo([{ texto: b.texto, negrito: true }], 22)];
            return b.paragrafos.map((p) => paragrafo(p, 18));
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(documento);
}
