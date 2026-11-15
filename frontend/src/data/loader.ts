// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Lê os JSON pré-calculados da pasta public/data. São arquivos estáticos:
// o site funciona sem a API (princípio de segurança da demo).

import type { SiteCatalog, SiteData, Summary } from './contract';

const DATA_URL = `${import.meta.env.BASE_URL}data`;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export function loadSiteCatalog(): Promise<SiteCatalog> {
  return getJson<SiteCatalog>(`${DATA_URL}/sites.json`);
}

export function loadSiteData(siteId: string): Promise<SiteData> {
  return getJson<SiteData>(`${DATA_URL}/sites/${encodeURIComponent(siteId)}.json`);
}

/** Resumo das métricas de todas as regiões. Se o arquivo não existir, devolve null. */
export async function loadSummary(): Promise<Summary | null> {
  try {
    return await getJson<Summary>(`${DATA_URL}/summary.json`);
  } catch {
    return null;
  }
}
