// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Conversa com o back end (FastAPI). Por enquanto só existe /health,
// que serve para saber se a API está no ar.
// O site precisa funcionar MESMO com a API desligada (a demo usa dados
// pré-calculados), então toda chamada aqui tem que tolerar falha.

import type { SiteData } from './data/contract';

const API_BASE = '/api';

export async function checkApiHealth(): Promise<boolean> {
  try {
    // Desiste depois de 3 segundos para não travar a interface.
    const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Pede à API o cálculo ao vivo de um ponto qualquer (rota /analyze).
 * Pode levar vários segundos: a API lê o relevo e consulta o Horizons.
 * Em caso de erro, lança um Error com a mensagem que a API devolveu.
 */
export async function analyzePoint(lat: number, lon: number): Promise<SiteData> {
  const url = `${API_BASE}/analyze?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
      else if (response.status === 422) detail = 'The point must be between 80°S and the pole.';
    } catch {
      /* resposta sem JSON: fica só o código HTTP */
    }
    throw new Error(detail);
  }
  return (await response.json()) as SiteData;
}
