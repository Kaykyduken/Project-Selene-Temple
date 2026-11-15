// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Painel do local selecionado (lateral direita). Tem dois modos, que mostram
// EXATAMENTE os mesmos números com apresentações diferentes:
//   - Educational: frases simples, explicações e os gráficos
//   - Expert: métricas com a origem de cada número, parâmetros do cálculo,
//     as consultas ao Horizons e download dos dados (CSV e JSON)
// Nos dois modos dá para comparar o local com outra região, lado a lado.

import type { Metric, Mode, ProvenanceClass, SiteData, SiteSummary } from '../data/contract';
import { marginChart } from '../charts/marginChart';
import { panoramaChart } from '../charts/panoramaChart';
import { margins } from '../charts/svg';

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

/** Número ou "no data". Regra do contrato: sem dado NUNCA aparece como zero. */
function show(metric: Metric, unit: string): string {
  return metric.value === null ? 'no data' : `${metric.value} ${unit}`;
}

function metricRow(label: string, metric: Metric, unit: string): HTMLElement {
  const row = el('div', 'metric');
  row.append(el('span', 'metric-label', label));
  row.append(el('span', 'metric-value', show(metric, unit)));
  row.append(el('span', `provenance provenance-${metric.class}`, CLASS_LABEL[metric.class]));
  return row;
}

/** Faz o navegador baixar um texto como arquivo. */
function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Série temporal em CSV: uma linha por instante, com a margem sobre o relevo. */
function toCsv(data: SiteData): string {
  const m = margins(data);
  const head = 't_utc,sun_az_deg,sun_el_deg,sun_margin_deg,sun_visible,earth_az_deg,earth_el_deg,earth_margin_deg,earth_visible';
  const lines = data.series.map((p, i) =>
    [p.t_utc, p.sun.az_deg, p.sun.el_deg, m.sun[i].toFixed(3), p.sun.visible,
     p.earth.az_deg, p.earth.el_deg, m.earth[i].toFixed(3), p.earth.visible].join(','),
  );
  const note = data.fictitious ? '# FICTITIOUS DATA\n' : '';
  return `${note}${head}\n${lines.join('\n')}\n`;
}

export class SitePanel {
  private mode: Mode = 'educational';
  private current: SiteData | null = null;
  private other: SiteData | null = null; // região escolhida para comparar

  /**
   * sites: lista de regiões (para o seletor "Compare with").
   * loadSite: função que busca os dados de uma região pelo id.
   */
  constructor(
    private container: HTMLElement,
    private sites: SiteSummary[] = [],
    private loadSite: (id: string) => Promise<SiteData> = () => Promise.reject(new Error('no loader')),
  ) {
    this.showEmpty();
  }

  /** Troca de modo e redesenha o que estiver na tela. */
  setMode(mode: Mode): void {
    this.mode = mode;
    if (this.current) this.render();
  }

  showEmpty(): void {
    this.current = null;
    this.container.replaceChildren(el('p', 'muted', 'Choose a region from the list or click a marker on the map.'));
  }

  showLoading(name: string): void {
    this.current = null;
    this.container.replaceChildren(el('h2', '', name), el('p', 'muted', 'Loading…'));
  }

  showError(name: string): void {
    this.current = null;
    this.container.replaceChildren(el('h2', '', name), el('p', 'muted', 'No data available for this site.'));
  }

  /** Ponto livre clicado no mapa: ainda não tem análise. */
  showCustomPoint(lat: number, lon: number): void {
    this.current = null;
    this.container.replaceChildren(
      el('h2', '', 'Custom point'),
      el('p', 'coords', formatLatLon(lat, lon)),
      el('p', 'muted', 'No data: analysis of custom points is not available yet.'),
    );
  }

  showSite(data: SiteData): void {
    this.current = data;
    this.other = null;
    this.render();
  }

  private render(): void {
    const data = this.current!;
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
      const area = data.site.area_km2 ? ` Region area: ${data.site.area_km2} km².` : '';
      nodes.push(el('p', 'muted', `Centre of the region area (USGS grid), not a selected landing point.${area}`));
    }

    nodes.push(...(this.mode === 'educational' ? this.educational(data) : this.expert(data)));
    nodes.push(...this.comparison(data));

    nodes.push(el('h3', '', 'Sources'));
    const sources = el('ul', 'sources');
    for (const source of data.sources) sources.append(el('li', '', source.name));
    nodes.push(sources);
    nodes.push(el('p', 'disclaimer', 'Geometric visibility only, for one point and one period. Not a certification for space missions.'));

    this.container.replaceChildren(...nodes);
  }

  /** Modo Educacional: os mesmos números, ditos em frases. */
  private educational(data: SiteData): HTMLElement[] {
    const { sun_time_pct: sun, earth_time_pct: earth, longest_no_sun_h: dark } = data.metrics;
    const days = Math.round((Date.parse(data.period.end_utc) - Date.parse(data.period.start_utc)) / 86_400_000);
    const nodes: HTMLElement[] = [];

    const card = (title: string, big: string, text: string) => {
      const box = el('div', 'edu-card');
      box.append(el('span', 'edu-title', title), el('span', 'edu-big', big), el('p', '', text));
      return box;
    };
    nodes.push(el('h3', '', `What happens here over ${days} days`));
    nodes.push(card('Sunlight (solar power)', show(sun, '%'),
      'Share of the time the Sun is above the surrounding hills. Solar panels only make power during this time.'));
    nodes.push(card('Earth in view (direct radio link)', show(earth, '%'),
      'Share of the time the Earth is above the surrounding hills. A direct radio link needs a clear line of sight to Earth.'));
    nodes.push(card('Longest time in the dark', dark.value === null ? 'no data' : `${dark.value} h`,
      dark.value === null ? '' : `About ${(dark.value / 24).toFixed(1)} Earth days in a row without sunlight. Batteries and heaters must last that long.`));

    nodes.push(el('h3', '', 'Why do hills matter so much?'));
    nodes.push(el('p', 'muted', 'Near the lunar south pole the Sun and the Earth never climb high in the sky: they stay within a few degrees of the horizon. A hill or a crater rim in the right direction is enough to hide them, so two places a few kilometres apart can be very different.'));

    nodes.push(el('h3', '', 'When are they in view?'));
    nodes.push(el('p', 'muted', 'The lines show how far the Sun and the Earth are above (+) or below (−) the hills. Above the "terrain horizon" line they are in view. The coloured bars underneath mark those periods.'));
    nodes.push(marginChart(data));

    nodes.push(el('h3', '', 'The view around the site'));
    nodes.push(el('p', 'muted', 'Imagine turning all the way around. The grey shape is the outline of the hills. The Sun travels along the orange line; the Earth stays in the small blue loop. They can be seen where their line is above the grey shape.'));
    nodes.push(panoramaChart(data));
    return nodes;
  }

  /** Modo Especialista: números com origem, parâmetros, consultas e downloads. */
  private expert(data: SiteData): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    nodes.push(el('h3', '', 'Visibility over the local horizon'));
    nodes.push(metricRow('Time with Sun in view', data.metrics.sun_time_pct, '%'));
    nodes.push(metricRow('Time with Earth in view', data.metrics.earth_time_pct, '%'));
    nodes.push(metricRow('Longest period without Sun', data.metrics.longest_no_sun_h, 'h'));
    nodes.push(metricRow('Mean slope', data.metrics.mean_slope_deg, '°'));

    nodes.push(el('h3', '', 'Margin above the terrain horizon'));
    nodes.push(el('p', 'muted', 'Body elevation minus terrain elevation at the same azimuth, in degrees. Bars: periods with positive margin.'));
    nodes.push(marginChart(data));
    nodes.push(el('h3', '', 'Horizon mask'));
    nodes.push(el('p', 'muted', 'Terrain elevation angle by azimuth (lunar curvature included), with the Sun and Earth tracks for the period.'));
    nodes.push(panoramaChart(data));

    // Parâmetros do cálculo: tudo que alguém precisa para reproduzir o resultado.
    nodes.push(el('h3', '', 'Parameters'));
    const h = data.horizon;
    const params: [string, string][] = [
      ['Period (UTC)', `${data.period.start_utc} to ${data.period.end_utc}`],
      ['Time step', `${data.period.step_min} min`],
      ['Observer height', `${data.site.observer_height_m} m above ground`],
      ['Ground height', data.site.ground_height_m === undefined ? 'no data' : `${data.site.ground_height_m} m (sphere R = 1737.4 km)`],
      ['DEM', h.dem.product ? `${h.dem.product}, ${h.dem.resolution_m} m/pixel` : 'no data'],
      ['Scan radius', h.max_radius_km === null ? 'no data' : `${h.max_radius_km} km`],
      ['Shortest DEM reach', h.min_data_reach_km === undefined ? 'no data' : `${h.min_data_reach_km} km (DEM edge)`],
      ['Visibility criterion', h.visibility_criterion === 'disc_center' ? 'centre of the disc above the terrain' : 'any part of the disc above the terrain'],
    ];
    const table = el('dl', 'params');
    for (const [name, value] of params) table.append(el('dt', '', name), el('dd', '', value));
    nodes.push(table);

    if (data.queries) {
      nodes.push(el('h3', '', 'JPL Horizons queries'));
      const list = el('ul', 'sources');
      for (const [name, url] of [['Sun', data.queries.sun], ['Earth', data.queries.earth]]) {
        const item = el('li');
        const link = el('a', '', `${name}: open the exact query`);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        item.append(link);
        list.append(item);
      }
      nodes.push(list);
    }

    nodes.push(el('h3', '', 'Download'));
    const actions = el('div', 'actions');
    const csv = el('button', '', 'Time series (CSV)');
    csv.type = 'button';
    csv.addEventListener('click', () => download(`${data.site.id}.csv`, toCsv(data), 'text/csv'));
    const json = el('button', '', 'Full data (JSON)');
    json.type = 'button';
    json.addEventListener('click', () => download(`${data.site.id}.json`, JSON.stringify(data, null, 1), 'application/json'));
    actions.append(csv, json);
    nodes.push(actions);
    return nodes;
  }

  /** Comparação lado a lado com outra região (mesmos números dos painéis individuais). */
  private comparison(data: SiteData): HTMLElement[] {
    const others = this.sites.filter((s) => s.id !== data.site.id);
    if (others.length === 0) return [];
    const nodes: HTMLElement[] = [el('h3', '', 'Compare with another region')];

    const select = el('select', 'compare-select');
    select.setAttribute('aria-label', 'Region to compare with');
    select.append(new Option('Choose a region…', ''));
    for (const s of others) select.append(new Option(s.name, s.id));
    select.value = this.other?.site.id ?? '';
    select.addEventListener('change', async () => {
      const id = select.value;
      try {
        this.other = id ? await this.loadSite(id) : null;
      } catch {
        this.other = null;
      }
      if (this.current === data) this.render(); // só redesenha se o usuário não trocou de região
    });
    nodes.push(select);

    if (this.other) {
      const b = this.other;
      const table = el('table', 'compare');
      const head = el('tr');
      head.append(el('th', '', ''), el('th', '', data.site.name), el('th', '', b.site.name));
      table.append(head);
      const rows: [string, Metric, Metric, string][] = [
        ['Sun in view', data.metrics.sun_time_pct, b.metrics.sun_time_pct, '%'],
        ['Earth in view', data.metrics.earth_time_pct, b.metrics.earth_time_pct, '%'],
        ['Longest period without Sun', data.metrics.longest_no_sun_h, b.metrics.longest_no_sun_h, 'h'],
      ];
      for (const [label, ma, mb, unit] of rows) {
        const tr = el('tr');
        tr.append(el('th', '', label), el('td', '', show(ma, unit)), el('td', '', show(mb, unit)));
        table.append(tr);
      }
      nodes.push(table);
      // Comparar períodos diferentes seria enganoso: avisamos se não forem iguais.
      if (b.period.start_utc !== data.period.start_utc || b.period.end_utc !== data.period.end_utc) {
        nodes.push(el('p', 'warning', '⚠ The two regions were computed for different periods.'));
      }
      if (b.fictitious) nodes.push(el('p', 'warning', `⚠ ${b.site.name}: FICTITIOUS DATA.`));
    }
    return nodes;
  }
}
