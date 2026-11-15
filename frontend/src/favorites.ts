// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// "Favorites": os pontos livres que o usuário quer GUARDAR.
// Regra do site: o resultado de um ponto livre é descartado assim que o usuário
// clica em outro ponto. A única exceção são os pontos marcados como favoritos.
//
// ONDE FICAM GUARDADOS:
//   - Com a API do projeto ligada: num ARQUIVO na máquina, data/favorites.json.
//     O site lê esse arquivo ao abrir (GET /favorites) e regrava a cada mudança
//     (PUT /favorites). Um site no navegador não consegue ler arquivos do
//     computador sozinho; por isso quem lê e grava é a API.
//   - Sem a API (site publicado): no próprio navegador (localStorage), como reserva.

import type { SiteData } from './data/contract';

const STORAGE_KEY = 'llsn.favorites.v1';
const API_URL = '/api/favorites';
/** Limite de favoritos (o mesmo do back end). Cada um guarda ~140 KB. */
export const MAX_FAVORITES = 12;

export class Favorites {
  private items: SiteData[] = [];
  private useFile = false;
  /** Função chamada sempre que a lista muda (para redesenhar a tela). */
  onChange: () => void = () => {};
  /** Função chamada se a gravação no arquivo falhar (para avisar o usuário). */
  onError: (message: string) => void = () => {};

  /** Carrega os favoritos ao abrir o site. apiOnline diz se a API respondeu. */
  async load(apiOnline: boolean): Promise<void> {
    const local = this.readLocal();
    if (apiOnline) {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        this.items = (await response.json()) as SiteData[];
        this.useFile = true;
        // Favoritos antigos, salvos só no navegador, são passados para o arquivo uma vez.
        const extra = local.filter((d) => !this.has(d.site.id)).slice(0, MAX_FAVORITES - this.items.length);
        if (extra.length > 0) {
          this.items.push(...extra);
          await this.save();
        }
        this.clearLocal();
      } catch {
        this.items = local; // a API falhou: usa a reserva do navegador
      }
    } else {
      this.items = local;
    }
    this.onChange();
  }

  /** Onde os favoritos estão sendo guardados (para mostrar na tela). */
  where(): string {
    return this.useFile ? 'Saved in data/favorites.json on this computer.' : 'Saved in this browser only (project API not running).';
  }

  list(): SiteData[] {
    return this.items;
  }

  has(id: string): boolean {
    return this.items.some((d) => d.site.id === id);
  }

  /** Adiciona. Devolve false se o limite foi atingido. */
  add(data: SiteData): boolean {
    if (this.has(data.site.id)) return true;
    if (this.items.length >= MAX_FAVORITES) return false;
    this.items.push(data);
    void this.save();
    return true;
  }

  remove(id: string): void {
    this.items = this.items.filter((d) => d.site.id !== id);
    void this.save();
  }

  private async save(): Promise<void> {
    this.onChange(); // a tela atualiza na hora; a gravação segue em segundo plano
    if (this.useFile) {
      try {
        const response = await fetch(API_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.items),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch {
        this.onError('Could not save Favorites to the file. Is the project API still running?');
      }
      return;
    }
    // localStorage pode estar bloqueado (aba anônima, configurações): por isso o try/catch.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      this.onError('Could not save Favorites in this browser.');
    }
  }

  private readLocal(): SiteData[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as SiteData[]) : [];
    } catch {
      return [];
    }
  }

  private clearLocal(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nada a fazer */
    }
  }
}
