import { describe, expect, it } from "vitest";
import { hasPdfMagicBytes, sanitizeFileName, sha256Hex } from "./upload-validation";

const enc = (s: string) => new TextEncoder().encode(s);

describe("hasPdfMagicBytes", () => {
  it("aceita conteúdo iniciado por %PDF-", () => {
    expect(hasPdfMagicBytes(enc("%PDF-1.7\n..."))).toBe(true);
  });
  it("rejeita conteúdo sem a assinatura (mesmo com extensão .pdf)", () => {
    expect(hasPdfMagicBytes(enc("<html>não é pdf"))).toBe(false);
  });
  it("rejeita buffer menor que a assinatura", () => {
    expect(hasPdfMagicBytes(enc("%PD"))).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("substitui espaços e caracteres especiais por _", () => {
    expect(sanitizeFileName("Tabela Ágil (2024).pdf")).toBe("Tabela__gil__2024_.pdf");
  });
  it("preserva letras, números, ponto, hífen e underscore", () => {
    expect(sanitizeFileName("plano_2024-v1.pdf")).toBe("plano_2024-v1.pdf");
  });
  it("usa fallback quando o nome fica vazio", () => {
    expect(sanitizeFileName("")).toBe("documento.pdf");
  });
});

describe("sha256Hex", () => {
  it("gera o hash canônico determinístico", () => {
    expect(sha256Hex(enc("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
