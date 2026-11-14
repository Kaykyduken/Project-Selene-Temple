// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Lista das regiões na lateral esquerda. São botões de verdade (<button>),
// então funcionam com teclado (Tab e Enter) sem código extra.

import type { SiteSummary } from '../data/contract';

export class SiteList {
  private buttons = new Map<string, HTMLButtonElement>();

  constructor(container: HTMLElement, sites: SiteSummary[], onSelect: (site: SiteSummary) => void) {
    const list = document.createElement('ul');
    list.className = 'site-list';
    for (const site of sites) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = site.name;
      button.addEventListener('click', () => onSelect(site));
      item.append(button);
      list.append(item);
      this.buttons.set(site.id, button);
    }
    container.replaceChildren(list);
  }

  highlight(id: string | null): void {
    for (const [siteId, button] of this.buttons) {
      const selected = siteId === id;
      button.classList.toggle('selected', selected);
      // aria-pressed avisa leitores de tela qual item está escolhido.
      button.setAttribute('aria-pressed', String(selected));
    }
  }
}
