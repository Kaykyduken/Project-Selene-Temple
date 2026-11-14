// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Conversa com o back end (FastAPI). Por enquanto só existe /health,
// que serve para saber se a API está no ar.
// O site precisa funcionar MESMO com a API desligada (a demo usa dados
// pré-calculados), então toda chamada aqui tem que tolerar falha.

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
