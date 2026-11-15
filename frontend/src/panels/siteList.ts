// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Lista das regiões na lateral esquerda, que também serve de COMPARAÇÃO entre
// todas: cada linha mostra a % de tempo com Sol e com a Terra à vista, e os
// botões do cabeçalho ordenam a lista por qualquer uma das colunas.
// São botões de verdade (<button>), então funcionam com teclado (Tab e Enter).

import type { SiteSummary, Summary, SummaryRow } from '../data/contract';
import { t } from '../i18n';

type SortKey = 'name' | 'sun' | 'earth';

export class SiteList {
  private buttons = new Map<string, HTMLButtonElement>();
  private rows = new Map<string, SummaryRow>();
  private order: SiteSummary[];
  private sortKey: SortKey = 'name';
  private selected: string | null = null;

  constructor(
    private container: HTMLElement,
    private sites: SiteSummary[],
    summary: Summary | null,
    private onSelect: (site: SiteSummary) => void,
  ) {
    for (const row of summary?.sites ?? []) this.rows.set(row.id, row);
    this.order = [...sites];
    this.render();
  }

  private value(site: SiteSummary, key: SortKey): number {
    const row = this.rows.get(site.id);
    return (key === 'sun' ? row?.sun_time_pct : row?.earth_time_pct) ?? -1; // sem dado vai para o fim
  }

  private sortBy(key: SortKey): void {
    this.sortKey = key;
    // Por nome: volta à ordem original do catálogo. Por número: do maior para o menor.
    this.order = key === 'name' ? [...this.sites] : [...this.sites].sort((a, b) => this.value(b, key) - this.value(a, key));
    this.render();
  }

  private render(): void {
    this.buttons.clear();
    const hasNumbers = this.rows.size > 0;

    // Cabeçalho: três botões de ordenação
    const head = document.createElement('div');
    head.className = 'site-row site-head';
    const headers: [SortKey, string][] = [['name', t('Region')], ['sun', t('Sun %')], ['earth', t('Earth %')]];
    for (const [key, label] of hasNumbers ? headers : headers.slice(0, 1)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label + (this.sortKey === key && key !== 'name' ? ' ▾' : '');
      b.setAttribute('aria-pressed', String(this.sortKey === key));
      b.title = key === 'name' ? t('Default order') : t('Sort by {label}, highest first', { label });
      b.addEventListener('click', () => this.sortBy(key));
      head.append(b);
    }

    const list = document.createElement('ul');
    list.className = 'site-list';
    for (const site of this.order) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'site-row';
      const name = document.createElement('span');
      name.textContent = site.name;
      button.append(name);
      if (hasNumbers) {
        const row = this.rows.get(site.id);
        for (const v of [row?.sun_time_pct, row?.earth_time_pct]) {
          const cell = document.createElement('span');
          cell.className = 'num';
          cell.textContent = v === null || v === undefined ? '–' : v.toFixed(0);
          button.append(cell);
        }
      }
      button.addEventListener('click', () => this.onSelect(site));
      item.append(button);
      list.append(item);
      this.buttons.set(site.id, button);
    }
    this.container.replaceChildren(head, list);
    this.highlight(this.selected);
  }

  highlight(id: string | null): void {
    this.selected = id;
    for (const [siteId, button] of this.buttons) {
      const selected = siteId === id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected)); // para leitores de tela
    }
  }
}
