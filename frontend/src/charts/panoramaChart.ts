// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Gráfico 2: o "panorama" do local. É como girar 360° no ponto e desenhar a
// silhueta do relevo: eixo X = direção (N, L, S, O), eixo Y = altura angular.
// Por cima vão os caminhos do Sol e da Terra no céu durante o período.
// Onde o caminho passa ACIMA da silhueta, o astro aparece.

import type { BodyPosition, SiteData } from '../data/contract';
import { COLOR, Tooltip, legend, scale, svg, ticks } from './svg';
import { t } from '../i18n';

const W = 380, H = 190;
const LEFT = 34, RIGHT = 10, TOP = 10, BOTTOM = 168;

export function panoramaChart(data: SiteData): HTMLElement {
  const host = document.createElement('div');
  host.className = 'chart';
  const terrain = data.horizon.elevation_deg;
  const step = 360 / terrain.length;

  // Domínio do eixo Y: mostra os astros inteiros; o relevo é cortado em +10°
  // (um paredão de 15° não precisa aparecer inteiro para sabermos que tapa tudo).
  const bodies = data.series.flatMap((p) => [p.sun.el_deg, p.earth.el_deg]);
  const yMin = Math.floor(Math.min(...terrain, ...bodies, -1));
  const yMax = Math.max(Math.ceil(Math.max(...bodies)) + 1, Math.min(10, Math.ceil(Math.max(...terrain, 1))));

  // A Terra quase não sai do lugar no céu da Lua. Giramos o eixo X para que a
  // direção média dela fique no MEIO do gráfico; assim o caminho dela não fica
  // partido entre a borda esquerda e a direita. (Média "circular": 359° e 1° dão 0°.)
  const rad = data.series.map((p) => (p.earth.az_deg * Math.PI) / 180);
  const mean = (Math.atan2(rad.reduce((a, r) => a + Math.sin(r), 0), rad.reduce((a, r) => a + Math.cos(r), 0)) * 180) / Math.PI;
  const center = ((Math.round(mean / 45) * 45) % 360 + 360) % 360; // arredonda para N, NE, L, ...
  const start = (center + 180) % 360; // azimute na borda esquerda do gráfico
  /** Quantos graus o azimute está à direita da borda esquerda (0 a 360). */
  const offset = (az: number) => (((az - start) % 360) + 360) % 360;
  const xs = scale(0, 360, LEFT, W - RIGHT);
  const x = (az: number) => xs(offset(az));
  const y = scale(yMin, yMax, BOTTOM, TOP);
  const clamp = (v: number) => Math.max(yMin, Math.min(yMax, v));

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
  root.setAttribute('aria-label', t('Terrain horizon around the site with the paths of the Sun and the Earth'));

  for (const t of ticks(yMin, yMax)) {
    root.append(svg('line', { x1: LEFT, x2: W - RIGHT, y1: y(t), y2: y(t), stroke: t === 0 ? COLOR.zero : COLOR.grid, 'stroke-width': 1 }));
    root.append(svg('text', { x: LEFT - 6, y: y(t) + 3.5, 'text-anchor': 'end', class: 'chart-text' }, `${t}°`));
  }
  const NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let k = 0; k <= 4; k++) {
    const az = (start + k * 90) % 360;
    root.append(svg('text', { x: xs(k * 90), y: H - 6, 'text-anchor': k === 0 ? 'start' : k === 4 ? 'end' : 'middle', class: 'chart-text' }, NAMES[Math.round(az / 45) % 8]));
  }

  // Silhueta do relevo: uma área fechada, do fundo do gráfico até a linha do horizonte.
  // Repetimos o primeiro valor em 360° para a silhueta fechar a volta.
  const first = Math.round(start / step); // índice do perfil que cai na borda esquerda
  const profile: string[] = [];
  for (let k = 0; k <= terrain.length; k++) {
    const v = terrain[(first + k) % terrain.length];
    profile.push(`${xs(k * step).toFixed(1)},${y(clamp(v)).toFixed(1)}`);
  }
  root.append(svg('polygon', { points: `${xs(0)},${BOTTOM} ${profile.join(' ')} ${xs(360)},${BOTTOM}`, fill: COLOR.terrain }));

  // Caminho de um astro. Quando o azimute "dá a volta" (359° → 0°), cortamos a
  // linha em dois pedaços; senão ela riscaria o gráfico de ponta a ponta.
  const track = (pick: (p: SiteData['series'][number]) => BodyPosition, color: string) => {
    let piece: string[] = [];
    let last: number | null = null;
    const flush = () => {
      if (piece.length > 1) root.append(svg('polyline', { points: piece.join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
      else if (piece.length === 1) {
        const [cx, cy] = piece[0].split(',');
        root.append(svg('circle', { cx, cy, r: 2, fill: color }));
      }
      piece = [];
    };
    for (const p of data.series) {
      const b = pick(p);
      if (last !== null && Math.abs(offset(b.az_deg) - last) > 180) flush();
      piece.push(`${x(b.az_deg).toFixed(1)},${y(clamp(b.el_deg)).toFixed(1)}`);
      last = offset(b.az_deg);
    }
    flush();
  };
  track((p) => p.earth, COLOR.earth);
  track((p) => p.sun, COLOR.sun);

  // Interação: a linha vertical escolhe uma direção e a caixinha diz a altura do relevo ali.
  const cross = svg('line', { y1: TOP, y2: BOTTOM, stroke: COLOR.zero, 'stroke-width': 1, visibility: 'hidden' });
  const hit = svg('rect', { x: LEFT, y: TOP, width: W - RIGHT - LEFT, height: BOTTOM - TOP, fill: 'transparent' });
  root.append(cross, hit);
  host.append(legend([[COLOR.sun, t('Sun path')], [COLOR.earth, t('Earth path')], [COLOR.terrain, t('Terrain')]]), root);
  const tip = new Tooltip(host);
  const far = data.horizon.blocker_distance_km;

  hit.addEventListener('pointermove', (e) => {
    const box = root.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const k = Math.max(0, Math.min(terrain.length, Math.round((((px - LEFT) / (W - RIGHT - LEFT)) * 360) / step)));
    const i = (first + k) % terrain.length; // índice no perfil, desfazendo o giro do eixo
    cross.setAttribute('x1', String(xs(k * step)));
    cross.setAttribute('x2', String(xs(k * step)));
    cross.setAttribute('visibility', 'visible');
    const rows: [string | null, string, string][] = [[COLOR.terrain, t('terrain height'), `${terrain[i].toFixed(2)}°`]];
    if (far) rows.push([null, t('distance of that terrain'), `${far[i]} km`]);
    tip.show((xs(k * step) / W) * box.width, t('Azimuth {az}°', { az: Math.round(i * step) }), rows);
  });
  hit.addEventListener('pointerleave', () => {
    cross.setAttribute('visibility', 'hidden');
    tip.hide();
  });

  return host;
}
