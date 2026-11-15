// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Peças pequenas usadas pelos dois gráficos. Os gráficos são desenhados "na mão"
// em SVG (sem biblioteca de gráficos): são só linhas, retângulos e textos.

import type { SiteData } from '../data/contract';

/** Cores das séries (validadas para daltonismo e contraste no tema escuro). */
export const COLOR = { sun: '#c98500', earth: '#3987e5', terrain: '#3a4558', grid: '#2a3344', zero: '#8fa0b8' };

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Cria um elemento SVG com atributos (e texto, se houver). */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  text = '',
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}

/** Escala linear: converte um valor do dado (domínio) em pixels (faixa). */
export function scale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

/** Valores "redondos" para as marcas do eixo (ex.: -4, -2, 0, 2). */
export function ticks(min: number, max: number, count = 4): number[] {
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/**
 * Altura do relevo (graus) num azimute qualquer, interpolando entre os dois
 * valores vizinhos do perfil de 360 pontos. É a mesma conta do pipeline
 * (horizon_at em pipeline/horizon.py).
 */
export function horizonAt(elevation: number[], azimuthDeg: number): number {
  const step = 360 / elevation.length;
  const pos = (((azimuthDeg % 360) + 360) % 360) / step;
  const i = Math.floor(pos) % elevation.length;
  const j = (i + 1) % elevation.length; // o último emenda no primeiro
  const t = pos - Math.floor(pos);
  return elevation[i] * (1 - t) + elevation[j] * t;
}

/** "Margem" = quantos graus o astro está acima (+) ou abaixo (−) do relevo naquela direção. */
export function margins(data: SiteData): { sun: number[]; earth: number[] } {
  const h = data.horizon.elevation_deg;
  return {
    sun: data.series.map((p) => p.sun.el_deg - horizonAt(h, p.sun.az_deg)),
    earth: data.series.map((p) => p.earth.el_deg - horizonAt(h, p.earth.az_deg)),
  };
}

/** Caixinha de dica (tooltip) que acompanha o mouse dentro de um gráfico. */
export class Tooltip {
  private box = document.createElement('div');

  constructor(private host: HTMLElement) {
    this.box.className = 'chart-tooltip';
    this.box.hidden = true;
    host.append(this.box);
  }

  /** rows: [cor da série ou null, rótulo, valor]. textContent evita injeção de HTML. */
  show(xPx: number, title: string, rows: [string | null, string, string][]): void {
    this.box.replaceChildren();
    const head = document.createElement('div');
    head.className = 'chart-tooltip-title';
    head.textContent = title;
    this.box.append(head);
    for (const [color, label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'chart-tooltip-row';
      const key = document.createElement('span');
      key.className = 'chart-key';
      if (color) key.style.background = color;
      const strong = document.createElement('strong');
      strong.textContent = value;
      const name = document.createElement('span');
      name.textContent = label;
      row.append(key, strong, name);
      this.box.append(row);
    }
    this.box.hidden = false;
    // Mantém a caixinha dentro do gráfico: à direita do cursor, ou à esquerda se não couber.
    const width = this.box.offsetWidth;
    const left = xPx + 12 + width > this.host.clientWidth ? xPx - 12 - width : xPx + 12;
    this.box.style.left = `${Math.max(0, left)}px`;
  }

  hide(): void {
    this.box.hidden = true;
  }
}

/** Legenda com um tracinho da cor de cada série. */
export function legend(items: [string, string][]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'chart-legend';
  for (const [color, label] of items) {
    const item = document.createElement('span');
    const key = document.createElement('span');
    key.className = 'chart-key';
    key.style.background = color;
    item.append(key, document.createTextNode(label));
    box.append(item);
  }
  return box;
}
