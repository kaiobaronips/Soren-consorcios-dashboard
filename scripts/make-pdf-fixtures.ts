/**
 * Gera os PDFs de fixture usados pelos testes de extração de texto (Fase 6, Task 2).
 *
 * Dois arquivos são produzidos em `tests/fixtures/` e commitados no repositório:
 *
 *  - `tabela-simples.pdf`   — PDF "nativo" com uma tabela de 3 produtos de consórcio.
 *    Cada célula é desenhada como uma operação de texto independente, em posições
 *    x/y fixas, para que a reconstrução de linhas do `extractPdfText` (agrupamento
 *    por y + separador de 2 espaços entre colunas) seja exercitada de verdade.
 *
 *  - `digitalizado.pdf`     — PDF que simula um documento escaneado: só retângulos,
 *    nenhum texto. A camada de texto do pdfjs devolve < 20 chars, o que aciona o
 *    caminho de OCR. O OCR não vai reconhecer nenhum produto (não há dados legíveis)
 *    e é exatamente isso que o teste verifica: caminho de OCR acionado e registrado
 *    em log, sem inventar dados.
 *
 * Uso: `pnpm tsx scripts/make-pdf-fixtures.ts`
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const FIXTURES_DIR = path.resolve(process.cwd(), "tests/fixtures");

/** Uma coluna da tabela: rótulo de cabeçalho, posição x e os valores das linhas. */
type Column = { header: string; x: number; cells: string[] };

/**
 * Colunas da tabela de `tabela-simples.pdf`. Os x são bem espaçados para que o
 * pdfjs devolva cada célula como um item de texto distinto (gap horizontal grande
 * entre colunas → separador de 2 espaços na reconstrução).
 */
const COLUMNS: Column[] = [
  { header: "Produto", x: 40, cells: ["Auto Facil", "Imovel Plus", "Moto Ja"] },
  { header: "Codigo", x: 150, cells: ["001", "002", "003"] },
  { header: "Credito", x: 215, cells: ["R$ 50.000,00", "R$ 200.000,00", "R$ 15.000,00"] },
  { header: "Prazo", x: 330, cells: ["60", "180", "48"] },
  { header: "Taxa Adm", x: 400, cells: ["18,00%", "21,00%", "16,00%"] },
  { header: "Parcela", x: 490, cells: ["R$ 950,00", "R$ 1.350,00", "R$ 380,00"] },
];

async function buildTabelaSimples(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const draw = (text: string, x: number, y: number, useBold = false) =>
    page.drawText(text, { x, y, size: 10, font: useBold ? bold : font });

  page.drawText("Tabela de Consorcio", { x: 40, y: 740, size: 16, font: bold });

  const headerY = 700;
  for (const col of COLUMNS) draw(col.header, col.x, headerY, true);

  const rowCount = COLUMNS[0].cells.length;
  for (let row = 0; row < rowCount; row++) {
    const y = headerY - 30 * (row + 1);
    for (const col of COLUMNS) draw(col.cells[row], col.x, y);
  }

  return doc.save();
}

async function buildDigitalizado(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);

  // Somente retângulos cinza — simula um scan sem camada de texto (OCR-only).
  const rects = [
    { x: 40, y: 650, w: 532, h: 40 },
    { x: 40, y: 560, w: 260, h: 20 },
    { x: 320, y: 560, w: 252, h: 20 },
    { x: 40, y: 500, w: 532, h: 20 },
    { x: 40, y: 440, w: 532, h: 20 },
  ];
  for (const r of rects) {
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      color: rgb(0.82, 0.82, 0.82),
    });
  }

  return doc.save();
}

async function main() {
  await mkdir(FIXTURES_DIR, { recursive: true });

  const tabela = await buildTabelaSimples();
  await writeFile(path.join(FIXTURES_DIR, "tabela-simples.pdf"), tabela);

  const digitalizado = await buildDigitalizado();
  await writeFile(path.join(FIXTURES_DIR, "digitalizado.pdf"), digitalizado);

  console.log("Fixtures gerados em", FIXTURES_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
