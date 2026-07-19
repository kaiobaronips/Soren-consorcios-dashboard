import path from "node:path";
import { pathToFileURL } from "node:url";
import type { PageText } from "./parse-products";

/**
 * Extração de texto de PDF server-side (Node) com fallback de OCR.
 *
 * Estratégia por página:
 *  1. pdfjs-dist (build legacy p/ Node) devolve os itens de texto com posição x/y.
 *  2. As linhas são reconstruídas agrupando itens por y (mesma linha) e inserindo
 *     DOIS espaços entre colunas quando o gap horizontal indica troca de coluna.
 *     Isso é obrigatório: o parser da Task 1 divide colunas por /\s{2,}|\t/, então
 *     um único espaço fundiria colunas. Espaços internos de uma célula (ex.:
 *     "R$ 50.000,00") são preservados porque o pdfjs os devolve dentro do mesmo item.
 *  3. Páginas com < 20 caracteres de texto útil são tratadas como "digitalizadas":
 *     a página é rasterizada e passada por OCR (tesseract.js, worker efêmero).
 *
 * REGRA INVIOLÁVEL: OCR nunca inventa dados. Se o OCR não reconhecer nada (ou
 * estiver indisponível offline), a página sai com 0 linhas úteis, method "ocr" e
 * um registro em log — jamais um produto fabricado.
 *
 * Idioma do OCR: 'por' por padrão (documentos de consórcio são em pt-BR),
 * sobreponível via env `TESSERACT_LANG` (ex.: 'eng' se 'por' não estiver
 * disponível offline). O tesseract.js baixa o traineddata do idioma em runtime;
 * sem rede a chamada falha e o fallback degrada graciosamente (log + 0 dados).
 */

export type ExtractionMethod = "text" | "ocr";
export type ExtractedPage = PageText & { method: ExtractionMethod };

/** Abaixo disso a página é considerada sem camada de texto útil (scan → OCR). */
const MIN_TEXT_CHARS = 20;

/** Teto de tempo por página de OCR — evita travar caso a rede esteja lenta. */
const OCR_TIMEOUT_MS = 45_000;

/** Item de texto do pdfjs que interessa à reconstrução de linhas. */
type TextItem = { str: string; x: number; y: number; width: number; fontSize: number };

/** Diretório com as fontes padrão do pdfjs (evita warnings e melhora a extração). */
const STANDARD_FONT_DATA_URL = pathToFileURL(
  path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/"),
).href;

/** Extrai os itens de texto relevantes (descarta itens só de espaço). */
function toTextItems(items: readonly unknown[]): TextItem[] {
  const result: TextItem[] = [];
  for (const raw of items) {
    const item = raw as { str?: string; transform?: number[]; width?: number };
    if (typeof item.str !== "string" || item.str.trim() === "") continue;
    const transform = item.transform ?? [];
    result.push({
      str: item.str,
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
      width: item.width ?? 0,
      fontSize: Math.abs(transform[0] ?? transform[3] ?? 10) || 10,
    });
  }
  return result;
}

/**
 * Reconstrói as linhas de texto a partir dos itens posicionados do pdfjs.
 * Agrupa por y (tolerância proporcional à fonte) e, dentro da linha, ordena por x,
 * inserindo "  " (2 espaços) quando o gap horizontal indica mudança de coluna.
 */
export function reconstructLines(items: readonly unknown[]): string[] {
  const textItems = toTextItems(items);
  if (textItems.length === 0) return [];

  // Agrupa por linha: dois itens estão na mesma linha se seus y são próximos.
  const sortedByY = [...textItems].sort((a, b) => b.y - a.y);
  const rows: TextItem[][] = [];
  for (const item of sortedByY) {
    const tolerance = Math.max(item.fontSize * 0.5, 2);
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= tolerance);
    if (row) row.push(item);
    else rows.push([item]);
  }

  const lines: string[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let line = "";
    let prev: TextItem | null = null;
    for (const item of row) {
      if (prev === null) {
        line = item.str;
      } else {
        const gap = item.x - (prev.x + prev.width);
        const columnBreak = prev.fontSize * 0.5;
        const wordSpace = prev.fontSize * 0.15;
        if (gap > columnBreak) line += `  ${item.str}`;
        else if (gap > wordSpace) line += ` ${item.str}`;
        else line += item.str;
      }
      prev = item;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/** Conta caracteres não-espaço — mede se a página tem texto útil de verdade. */
function meaningfulCharCount(lines: string[]): number {
  return lines.join("").replace(/\s/g, "").length;
}

// Tipos mínimos do pdfjs usados aqui (evita depender de export de tipos internos).
type PdfViewport = { width: number; height: number };
type PdfPage = {
  getTextContent(): Promise<{ items: unknown[] }>;
  getViewport(opts: { scale: number }): PdfViewport;
  render(opts: { canvasContext: unknown; viewport: PdfViewport }): { promise: Promise<void> };
  cleanup(): void;
};

/** Rasteriza uma página do pdfjs em PNG (Buffer) via @napi-rs/canvas. */
async function renderPageToPng(page: PdfPage): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.encode("png");
}

/**
 * Roda OCR na página (worker efêmero: create → recognize → terminate).
 * Nunca lança: qualquer falha vira log e retorna [] (sem inventar dados).
 */
async function ocrPage(page: PdfPage, pageNumber: number, log: string[]): Promise<string[]> {
  const lang = process.env.TESSERACT_LANG?.trim() || "por";
  try {
    const png = await renderPageToPng(page);
    const { createWorker } = await import("tesseract.js");
    const worker = await Promise.race([
      createWorker(lang),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`OCR excedeu ${OCR_TIMEOUT_MS}ms`)), OCR_TIMEOUT_MS),
      ),
    ]);
    try {
      const { data } = await worker.recognize(png);
      const text = data.text ?? "";
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+$/, ""))
        .filter((line) => line.trim() !== "");
      log.push(
        `página ${pageNumber}: OCR (${lang}) concluído — ${meaningfulCharCount(lines)} char(s) reconhecido(s)`,
      );
      return lines;
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.push(`página ${pageNumber}: OCR (${lang}) indisponível — ${message}; nenhum dado inventado`);
    return [];
  }
}

/**
 * Extrai o texto de todas as páginas do PDF. Páginas com camada de texto usam o
 * caminho "text"; páginas sem texto útil (< 20 chars) usam o caminho "ocr".
 */
export async function extractPdfText(
  buffer: Buffer,
): Promise<{ pages: ExtractedPage[]; log: string[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const log: string[] = [];
  const pages: ExtractedPage[] = [];

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isOffscreenCanvasSupported: false,
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  const doc = await loadingTask.promise;

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = (await doc.getPage(pageNumber)) as unknown as PdfPage;
      try {
        const textContent = await page.getTextContent();
        const lines = reconstructLines(textContent.items);
        const charCount = meaningfulCharCount(lines);

        if (charCount >= MIN_TEXT_CHARS) {
          pages.push({ page: pageNumber, lines, method: "text" });
          log.push(
            `página ${pageNumber}: texto nativo extraído — ${charCount} char(s), ${lines.length} linha(s)`,
          );
        } else {
          log.push(
            `página ${pageNumber}: texto insuficiente (${charCount} char(s) < ${MIN_TEXT_CHARS}) — acionando OCR`,
          );
          const ocrLines = await ocrPage(page, pageNumber, log);
          pages.push({ page: pageNumber, lines: ocrLines, method: "ocr" });
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return { pages, log };
}
