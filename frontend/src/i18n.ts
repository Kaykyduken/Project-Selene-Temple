// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Idiomas do site: inglês (padrão, exigido pelo evento) e português do Brasil.
// Funciona como um dicionário: o código escreve o texto em inglês dentro de t('...')
// e, se o idioma escolhido for português, t devolve a tradução de locales/pt.ts.
// A escolha fica guardada no navegador; trocar de idioma recarrega a página.

import { PT } from './locales/pt';

export type Lang = 'en' | 'pt';
const STORAGE_KEY = 'llsn-lang';

function readLang(): Lang {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang'); // ex.: ?lang=pt
    if (fromUrl === 'pt' || fromUrl === 'en') return fromUrl;
    return localStorage.getItem(STORAGE_KEY) === 'pt' ? 'pt' : 'en';
  } catch {
    return 'en'; // navegador sem acesso ao armazenamento
  }
}

/** Idioma em uso nesta página. */
export const LANG: Lang = readLang();

/**
 * Traduz um texto. vars preenche os trechos {nome}:
 *   t('Day {n}', { n: 5 }) → "Day 5" ou "Dia 5"
 */
export function t(text: string, vars: Record<string, string | number> = {}): string {
  const base = LANG === 'pt' ? (PT[text] ?? text) : text;
  return base.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** Número como texto, com vírgula decimal em português (37.6 → "37,6"). */
export function num(value: number | string): string {
  return LANG === 'pt' ? String(value).replace('.', ',') : String(value);
}

/** Guarda o idioma e recarrega a página já nele. */
export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* sem armazenamento: vale só o endereço abaixo */
  }
  const url = new URL(location.href);
  url.searchParams.set('lang', lang);
  location.href = url.toString();
}

/**
 * Traduz os textos fixos do index.html (títulos, legenda, rodapé, rótulos de
 * acessibilidade). Roda uma vez, antes de o resto do site desenhar qualquer coisa.
 */
export function translatePage(): void {
  document.documentElement.lang = LANG === 'pt' ? 'pt-BR' : 'en';
  if (LANG === 'en') return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const original = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    if (!original || !PT[original]) continue;
    // Mantém um espaço nas pontas se o texto original tinha (ex.: texto ao lado de um ícone).
    const raw = node.nodeValue ?? '';
    node.nodeValue = (/^\s/.test(raw) ? ' ' : '') + PT[original] + (/\s$/.test(raw) ? ' ' : '');
  }
  for (const element of document.querySelectorAll<HTMLElement>('[aria-label], [title]')) {
    for (const attribute of ['aria-label', 'title']) {
      const value = element.getAttribute(attribute);
      if (value && PT[value]) element.setAttribute(attribute, PT[value]);
    }
  }
}
