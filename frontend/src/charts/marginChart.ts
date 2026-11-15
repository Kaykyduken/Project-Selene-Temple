// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Gráfico 1: "o Sol e a Terra estão acima do relevo? Quando?"
// Eixo X = tempo. Eixo Y = margem em graus: elevação do astro menos a altura do
// relevo na direção dele. Acima da linha do zero o astro está à vista; abaixo,
// está escondido pelo terreno. Embaixo, duas faixas mostram os períodos visíveis.

import type { SiteData } from '../data/contract';
import { COLOR, Tooltip, legend, margins, scale, svg, ticks } from './svg';

const W = 380; // largura lógica do desenho (o SVG estica para caber no painel)
const H = 230;
const LEFT = 34, RIGHT = 44, TOP = 10, PLOT_BOTTOM = 150, STRIP_H = 10;

export function marginChart(data: SiteData): HTMLElement {
  const host = document.createElement('div');
  host.className = 'chart';
  const m = margins(data);
  const n = data.series.length;
  const times = data.series.map((p) => Date.parse(p.t_utc));

  // Domínio do eixo Y: cobre os dados, mas corta em -12° para um astro muito
  // abaixo do relevo não achatar o resto do gráfico.
  const all = [...m.sun, ...m.earth];
  const yMin = Math.max(-12, Math.floor(Math.min(...all, -1)));
  const yMax = Math.ceil(Math.max(...all, 1));
  const x = scale(times[0], times[n - 1], LEFT, W - RIGHT);
  const y = scale(yMin, yMax, PLOT_BOTTOM, TOP);
  const clamp = (v: number) => Math.max(yMin, Math.min(yMax, v));

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  root.setAttribute('aria-label', 'Margin of the Sun and the Earth above the terrain horizon over time');

  // Grade horizontal e rótulos do eixo Y
  for (const t of ticks(yMin, yMax)) {
    root.append(svg('line', { x1: LEFT, x2: W - RIGHT, y1: y(t), y2: y(t), stroke: t === 0 ? COLOR.zero : COLOR.grid, 'stroke-width': 1 }));
    root.append(svg('text', { x: LEFT - 6, y: y(t) + 3.5, 'text-anchor': 'end', class: 'chart-text' }, `${t}°`));
  }
  // Nome da linha do zero, dentro do gráfico (à esquerda) para não bater nos nomes das séries.
  // (contorno da cor do fundo, para o texto continuar legível quando uma linha passa por trás)
  root.append(svg('text', { x: LEFT + 3, y: y(0) - 4, class: 'chart-text chart-text-halo' }, 'terrain horizon'));

  // Rótulos do eixo X: 4 datas ao longo do período
  for (let k = 0; k <= 3; k++) {
    const t = times[0] + ((times[n - 1] - times[0]) * k) / 3;
    const label = new Date(t).toISOString().slice(5, 10); // MM-DD
    root.append(svg('text', { x: x(t), y: H - 4, 'text-anchor': k === 0 ? 'start' : k === 3 ? 'end' : 'middle', class: 'chart-text' }, label));
  }

  // As duas linhas
  const line = (values: number[], color: string) =>
    svg('polyline', {
      points: values.map((v, i) => `${x(times[i]).toFixed(1)},${y(clamp(v)).toFixed(1)}`).join(' '),
      fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round',
    });
  root.append(line(m.earth, COLOR.earth), line(m.sun, COLOR.sun));
  root.append(root.querySelector('.chart-text-halo')!); // traz o nome da linha do zero para a frente

  // Nome de cada série na ponta direita da linha (afastados se ficarem colados)
  let ySun = y(clamp(m.sun[n - 1])), yEarth = y(clamp(m.earth[n - 1]));
  if (Math.abs(ySun - yEarth) < 11) {
    const mid = (ySun + yEarth) / 2;
    [ySun, yEarth] = ySun <= yEarth ? [mid - 6, mid + 6] : [mid + 6, mid - 6];
  }
  root.append(svg('text', { x: W - RIGHT + 4, y: ySun + 3.5, class: 'chart-text chart-text-strong' }, 'Sun'));
  root.append(svg('text', { x: W - RIGHT + 4, y: yEarth + 3.5, class: 'chart-text chart-text-strong' }, 'Earth'));

  // Faixas de visibilidade: um retângulo para cada período seguido "à vista"
  const strip = (flags: boolean[], color: string, top: number, name: string) => {
    root.append(svg('text', { x: LEFT - 6, y: top + STRIP_H - 1.5, 'text-anchor': 'end', class: 'chart-text' }, name));
    root.append(svg('rect', { x: LEFT, y: top, width: W - RIGHT - LEFT, height: STRIP_H, fill: COLOR.grid, rx: 2 }));
    let start = -1;
    for (let i = 0; i <= n; i++) {
      if (i < n && flags[i] && start < 0) start = i;
      if ((i === n || !flags[i]) && start >= 0) {
        const x0 = x(times[start]), x1 = x(times[Math.min(i, n - 1)]);
        root.append(svg('rect', { x: x0, y: top, width: Math.max(1.5, x1 - x0), height: STRIP_H, fill: color, rx: 2 }));
        start = -1;
      }
    }
  };
  strip(data.series.map((p) => p.sun.visible), COLOR.sun, PLOT_BOTTOM + 22, 'Sun');
  strip(data.series.map((p) => p.earth.visible), COLOR.earth, PLOT_BOTTOM + 38, 'Earth');

  // Camada de interação: linha vertical que segue o mouse + caixinha com os valores
  const cross = svg('line', { y1: TOP, y2: PLOT_BOTTOM + 38 + STRIP_H, stroke: COLOR.zero, 'stroke-width': 1, visibility: 'hidden' });
  const hit = svg('rect', { x: LEFT, y: TOP, width: W - RIGHT - LEFT, height: H - TOP - 14, fill: 'transparent' });
  root.append(cross, hit);
  host.append(legend([[COLOR.sun, 'Sun'], [COLOR.earth, 'Earth']]), root);
  const tip = new Tooltip(host);

  hit.addEventListener('pointermove', (e) => {
    const box = root.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W; // posição em unidades do desenho
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - LEFT) / (W - RIGHT - LEFT)) * (n - 1))));
    cross.setAttribute('x1', String(x(times[i])));
    cross.setAttribute('x2', String(x(times[i])));
    cross.setAttribute('visibility', 'visible');
    const fmt = (v: number, seen: boolean) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}° ${seen ? '(in view)' : '(hidden)'}`;
    tip.show((x(times[i]) / W) * box.width, data.series[i].t_utc.replace('T', ' ').slice(0, 16) + ' UTC', [
      [COLOR.sun, 'Sun', fmt(m.sun[i], data.series[i].sun.visible)],
      [COLOR.earth, 'Earth', fmt(m.earth[i], data.series[i].earth.visible)],
    ]);
  });
  hit.addEventListener('pointerleave', () => {
    cross.setAttribute('visibility', 'hidden');
    tip.hide();
  });

  return host;
}
