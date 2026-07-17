import ExcelJS from "exceljs";
import { fractionToPercentPoints, toMoneyString } from "./normalize";

export type ParsedProduct = {
  productName: string;
  productCode: string;
  creditAmount: string;
  termMonths: number;
  totalAdministrationFeePercent: string;
  first12InstallmentAmount: string;
  regularInstallmentAmount: string;
};

export type ParseResult = {
  products: ParsedProduct[];
  invalidRows: { rowNumber: number; reason: string }[];
};

const SHEET_NAME = "Consórcios";
// Cabeçalhos esperados (linha 1) — validados para detectar mudança de layout
const EXPECTED_HEADERS = [
  "Produto", "Código", "Valor da Carta (R$)", "Prazo (meses)",
  "Taxa Adm Total (%)", "Parcela 1ª a 12ª (R$)", "Parcela Mensal (R$)",
];

function cellNumber(v: ExcelJS.CellValue): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function cellText(v: ExcelJS.CellValue): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function parseConsorcioXlsx(filePath: string): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Aba "${SHEET_NAME}" não encontrada em ${filePath}`);

  const headers = EXPECTED_HEADERS.map((_, i) => cellText(ws.getRow(1).getCell(i + 1).value));
  EXPECTED_HEADERS.forEach((expected, i) => {
    if (headers[i] !== expected) {
      throw new Error(`Cabeçalho inesperado na coluna ${i + 1}: "${headers[i]}" (esperado "${expected}")`);
    }
  });

  const products: ParsedProduct[] = [];
  const invalidRows: ParseResult["invalidRows"] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(1).value);
    if (!name) return; // linha vazia — fim dos dados
    const code = cellText(row.getCell(2).value);
    const credit = cellNumber(row.getCell(3).value);
    const term = cellNumber(row.getCell(4).value);
    const fee = cellNumber(row.getCell(5).value);
    const first12 = cellNumber(row.getCell(6).value);
    const regular = cellNumber(row.getCell(7).value);

    const missing = [
      !code && "Código", !credit && "Valor da Carta", !term && "Prazo",
      !fee && "Taxa Adm", !first12 && "Parcela 1ª a 12ª", !regular && "Parcela Mensal",
    ].filter(Boolean);
    if (missing.length > 0) {
      invalidRows.push({ rowNumber, reason: `Campos ausentes/inválidos: ${missing.join(", ")}` });
      return;
    }
    if (credit! <= 0 || term! <= 0 || regular! <= 0) {
      invalidRows.push({ rowNumber, reason: "Valores não positivos" });
      return;
    }

    products.push({
      productName: name,
      productCode: code!,
      creditAmount: toMoneyString(credit!),
      termMonths: term!,
      totalAdministrationFeePercent: fractionToPercentPoints(fee!),
      first12InstallmentAmount: toMoneyString(first12!),
      regularInstallmentAmount: toMoneyString(regular!),
    });
  });

  return { products, invalidRows };
}
