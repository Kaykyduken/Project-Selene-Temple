// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Painel do local selecionado (lateral direita): coordenadas, métricas com a
// origem de cada número, e os avisos obrigatórios.

import type { Metric, ProvenanceClass, SiteData } from '../data/contract';
import { marginChart } from '../charts/marginChart';
import { panoramaChart } from '../charts/panoramaChart';

/** Texto e símbolo de cada classe de origem (nunca só cor: acessibilidade). */
const CLASS_LABEL: Record<ProvenanceClass, string> = {
  observed: '● Observed',
  model: '◆ Model',
  estimate: '▲ Estimate',
  hypothesis: '○ Hypothesis',
  no_data: '– No data',
};

/** Cria um elemento HTML com classe e texto. textContent evita injeção de HTML. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Formata latitude/longitude com hemisfério, ex.: "85.9000°S, 0.0000°E". */
export function formatLatLon(lat: number, lon: number): string {
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lon < 0 ? 'W' : 'E';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}

function metricRow(label: string, metric: Metric, unit: string): HTMLElement {
  const row = el('div', 'metric');
  row.append(el('span', 'metric-label', label));
  // Regra do contrato: sem dado aparece como "no data", NUNCA como zero.
  const text = metric.value === null ? 'no data' : `${metric.value} ${unit}`;
  row.append(el('span', 'metric-value', text));
  row.append(el('span', `provenance provenance-${metric.class}`, CLASS_LABEL[metric.class]));
  return row;
}

export class SitePanel {
  constructor(private container: HTMLElement) {
    this.showEmpty();
  }

  showEmpty(): void {
    this.container.replaceChildren(
      el('p', 'muted', 'Choose a region from the list or click a marker on the map.'),
    );
  }

  showLoading(name: string): void {
    this.container.replaceChildren(el('h2', '', name), el('p', 'muted', 'Loading…'));
  }

  showError(name: string): void {
    this.container.replaceChildren(el('h2', '', name), el('p', 'muted', 'No data available for this site.'));
  }

  /** Ponto livre clicado no mapa: ainda não tem análise (chega com a API, M5). */
  showCustomPoint(lat: number, lon: number): void {
    this.container.replaceChildren(
      el('h2', '', 'Custom point'),
      el('p', 'coords', formatLatLon(lat, lon)),
      el('p', 'muted', 'No data: analysis of custom points is not available yet.'),
    );
  }

  showSite(data: SiteData): void {
    const nodes: HTMLElement[] = [];

    // Faixa obrigatória quando o dado é fictício.
    if (data.fictitious) {
      const banner = el('div', 'banner-fictitious', '⚠ FICTITIOUS DATA — placeholder values for interface testing');
      banner.setAttribute('role', 'alert');
      nodes.push(banner);
    }

    nodes.push(el('h2', '', data.site.name));
    nodes.push(el('p', 'coords', formatLatLon(data.site.lat_deg, data.site.lon_deg)));
    if (!data.site.coordinate_origin.verified) {
      nodes.push(el('p', 'warning', '⚠ Approximate position, pending verification against the original source.'));
    } else {
      // Posição conferida: é o centro da área da região, não um ponto de pouso oficial.
      const area = data.site.area_km2 ? ` Region area: ${data.site.area_km2} km².` : '';
      nodes.push(el('p', 'muted', `Centre of the region area (USGS grid), not a selected landing point.${area}`));
    }

    const days = Math.round(
      (Date.parse(data.period.end_utc) - Date.parse(data.period.start_utc)) / 86_400_000,
    );
    nodes.push(
      el('p', 'muted', `Period: ${data.period.start_utc.slice(0, 10)} to ${data.period.end_utc.slice(0, 10)} UTC (${days} days, ${data.period.step_min} min step). Observer height: ${data.site.observer_height_m} m${data.site.ground_height_m !== undefined ? ` above ground at ${data.site.ground_height_m} m` : ''}.`),
    );

    nodes.push(el('h3', '', 'Visibility over the local horizon'));
    nodes.push(metricRow('Time with Sun (solar power)', data.metrics.sun_time_pct, '%'));
    nodes.push(metricRow('Time with Earth in view (direct comms)', data.metrics.earth_time_pct, '%'));
    nodes.push(metricRow('Longest period without Sun', data.metrics.longest_no_sun_h, 'h'));
    nodes.push(metricRow('Mean slope', data.metrics.mean_slope_deg, '°'));

    // Gráficos. Cada um tem uma frase explicando como ler (ninguém depende só do desenho).
    nodes.push(el('h3', '', 'When are they in view?'));
    nodes.push(el('p', 'muted', 'Degrees above (+) or below (−) the terrain in the direction of each body. Above the "terrain horizon" line it is in view. The bars underneath mark the periods in view.'));
    nodes.push(marginChart(data));

    nodes.push(el('h3', '', 'Horizon around the site'));
    nodes.push(el('p', 'muted', 'The terrain silhouette seen while turning 360°, with the paths of the Sun and the Earth in the sky. A body is in view where its path runs above the silhouette.'));
    nodes.push(panoramaChart(data));

    nodes.push(el('h3', '', 'Sources'));
    const sources = el('ul', 'sources');
    for (const source of data.sources) sources.append(el('li', '', source.name));
    nodes.push(sources);

    nodes.push(el('p', 'disclaimer', 'Geometric visibility only. Not a certification for space missions.'));

    this.container.replaceChildren(...nodes);
  }
}
