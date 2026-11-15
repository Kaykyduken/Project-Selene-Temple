// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// "Favorites": os pontos livres que o usuário quer GUARDAR.
// Regra do site: o resultado de um ponto livre é descartado assim que o usuário
// clica em outro ponto. A única exceção são os pontos marcados como favoritos,
// que ficam guardados aqui (com os dados calculados) e continuam no mapa.
//
// Os favoritos são salvos no próprio navegador (localStorage), então sobrevivem
// a recarregar a página, mas valem só para aquele navegador naquele computador.

import type { SiteData } from './data/contract';

const STORAGE_KEY = 'llsn.favorites.v1';
/** Limite de favoritos: cada um guarda ~140 KB e o navegador dá ~5 MB por site. */
export const MAX_FAVORITES = 12;

export class Favorites {
  private items: SiteData[] = [];
  /** Função chamada sempre que a lista muda (para redesenhar a tela). */
  onChange: () => void = () => {};

  constructor() {
    // localStorage pode estar bloqueado (aba anônima, configurações): por isso o try/catch.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) this.items = JSON.parse(saved) as SiteData[];
    } catch {
      this.items = [];
    }
  }

  list(): SiteData[] {
    return this.items;
  }

  has(id: string): boolean {
    return this.items.some((d) => d.site.id === id);
  }

  get(id: string): SiteData | undefined {
    return this.items.find((d) => d.site.id === id);
  }

  /** Adiciona. Devolve false se o limite foi atingido. */
  add(data: SiteData): boolean {
    if (this.has(data.site.id)) return true;
    if (this.items.length >= MAX_FAVORITES) return false;
    this.items.push(data);
    this.save();
    return true;
  }

  remove(id: string): void {
    this.items = this.items.filter((d) => d.site.id !== id);
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      /* sem espaço ou bloqueado: o favorito vale só até fechar a página */
    }
    this.onChange();
  }
}
