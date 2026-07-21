/**
 * Cliente da API pública de Séries Temporais (SGS) do Banco Central.
 * Sem autenticação. Nunca lança para o chamador travar uma tela — o serviço de
 * sincronização trata falha/timeout e mantém o último valor bom no banco.
 */
import { Agent, fetch as undiciFetch } from "undici";

// A API do SGS publica endereço IPv6; quando o IPv6 da rede não conecta, o fetch do Node
// (undici) trava (UND_ERR_CONNECT_TIMEOUT) — e o undici ignora o autoSelectFamily global
// do módulo net. Forçamos IPv4 (family: 4) no dispatcher só destas chamadas. Usamos o
// fetch DO undici instalado (não o global do Node) para o Agent e o fetch serem da mesma
// versão do undici — versões diferentes têm handlers internos incompatíveis.
const ipv4Agent = new Agent({ connect: { family: 4 } });

export type SgsPoint = { data: string; valor: string };

const BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

/** Busca os últimos `n` pontos de uma série do SGS. Timeout curto; erro → exceção tratada no serviço. */
export async function fetchSgsSeries(seriesCode: number, last: number, timeoutMs = 25000): Promise<SgsPoint[]> {
  const url = `${BASE}.${seriesCode}/dados/ultimos/${last}?formato=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await undiciFetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        // A API do SGS costuma bloquear/travar requisições sem User-Agent de navegador.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      dispatcher: ipv4Agent,
    });
    if (!res.ok) throw new Error(`SGS ${seriesCode} respondeu HTTP ${res.status}`);
    const json = (await res.json()) as SgsPoint[];
    if (!Array.isArray(json)) throw new Error(`SGS ${seriesCode}: resposta inesperada`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Converte a data do SGS ("dd/MM/yyyy") para ISO ("yyyy-MM-01") — usada como reference_period. */
export function sgsDateToReferencePeriod(data: string): string {
  const [, mm, yyyy] = data.split("/");
  return `${yyyy}-${mm.padStart(2, "0")}-01`;
}
