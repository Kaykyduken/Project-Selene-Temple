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
import { dayCalendar, tenHoursChart } from '../charts/simpleCharts';
import { downloadTool } from './downloadTool';
import { num, t } from '../i18n';

/** Texto e símbolo de cada classe de origem (nunca só cor: acessibilidade). */
const CLASS_LABEL: Record<ProvenanceClass, string> = {
  observed: t('● Observed'),
  model: t('◆ Model'),
  estimate: t('▲ Estimate'),
  hypothesis: t('○ Hypothesis'),
  no_data: t('– No data'),
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
  return metric.value === null ? t('no data') : `${num(metric.value)} ${unit}`;
}

/** periodHours: se dado e a unidade for %, mostra também as horas equivalentes ("34,4 % / 248 h"). */
function periodHoursOf(data: SiteData): number {
  return Math.round((Date.parse(data.period.end_utc) - Date.parse(data.period.start_utc)) / 3_600_000);
}

/** "37,6 % / 271 h": porcentagem do período e as horas equivalentes. */
function showPctHours(metric: Metric, periodHours: number): string {
  return metric.value === null ? t('no data') : `${show(metric, '%')} / ${num(Math.round((metric.value * periodHours) / 100))} h`;
}

function metricRow(label: string, metric: Metric, unit: string, periodHours?: number): HTMLElement {
  const row = el('div', 'metric');
  row.append(el('span', 'metric-label', label));
  const text = periodHours && unit === '%' ? showPctHours(metric, periodHours) : show(metric, unit);
  row.append(el('span', 'metric-value', text));
  row.append(el('span', `provenance provenance-${metric.class}`, CLASS_LABEL[metric.class]));
  return row;
}

export class SitePanel {
  private mode: Mode = 'educational';
  private current: SiteData | null = null;
  private other: SiteData | null = null; // região escolhida para comparar
  private compareCharts = false; // mostrar os gráficos das duas regiões juntos?
  private readonly openBlocks = new Set<string>(); // blocos do modo Expert que o usuário abriu (começam fechados)
  /** Ligação com os Favoritos (preenchida pelo main.ts). */
  favorites: { has: (id: string) => boolean; toggle: (data: SiteData) => string | null } | null = null;

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
    this.container.replaceChildren(el('p', 'muted', t('Choose a region from the list or click a marker on the map.')));
  }

  showLoading(name: string): void {
    this.current = null;
    this.container.replaceChildren(el('h2', '', name), el('p', 'muted', t('Loading…')));
  }

  showError(name: string): void {
    this.current = null;
    this.container.replaceChildren(el('h2', '', name), el('p', 'muted', t('No data available for this site.')));
  }

  /** Ponto livre clicado no mapa, enquanto não há resultado: mostra as coordenadas e um aviso. */
  showCustomPoint(lat: number, lon: number, message: string, isError = false): void {
    this.current = null;
    this.container.replaceChildren(
      el('h2', '', t('Custom point')),
      el('p', 'coords', formatLatLon(lat, lon)),
      el('p', isError ? 'warning' : 'muted', message),
    );
  }

  showSite(data: SiteData): void {
    this.current = data;
    this.other = null;
    this.render();
  }

  /** Bloco retrátil do modo Expert. Começa fechado; lembra se o usuário abriu ao redesenhar. */
  private block(title: string, children: HTMLElement[]): HTMLElement {
    const details = el('details', 'section block');
    details.open = this.openBlocks.has(title);
    details.append(el('summary', '', t(title)), ...children);
    details.addEventListener('toggle', () => {
      if (details.open) this.openBlocks.add(title);
      else this.openBlocks.delete(title);
    });
    return details;
  }

  private render(): void {
    const data = this.current!;
    const nodes: HTMLElement[] = [];

    // Faixa obrigatória quando o dado é fictício.
    if (data.fictitious) {
      const banner = el('div', 'banner-fictitious', t('⚠ FICTITIOUS DATA — placeholder values for interface testing'));
      banner.setAttribute('role', 'alert');
      nodes.push(banner);
    }

    nodes.push(el('h2', '', data.site.name));
    nodes.push(el('p', 'coords', formatLatLon(data.site.lat_deg, data.site.lon_deg)));
    nodes.push(el('p', 'muted', t('Not a mission certification: results are for exploration and education.')));
    if (data.site.custom && this.favorites) {
      // Botão de favorito: só os pontos livres precisam, porque só eles são descartados.
      const fav = this.favorites;
      const saved = fav.has(data.site.id);
      const star = el('button', 'favorite-button', saved ? t('★ In Favorites (click to remove)') : t('☆ Add to Favorites'));
      star.type = 'button';
      star.setAttribute('aria-pressed', String(saved));
      const note = el('p', 'muted', saved ? t('This point is kept.') : t('Without this, the result is discarded when you click another point.'));
      star.addEventListener('click', () => {
        const problem = fav.toggle(data);
        if (problem) note.textContent = problem;
        else this.render();
      });
      nodes.push(star, note);
    }
    if (data.site.custom) {
      nodes.push(el('p', 'muted', t('Point selected on the map, computed live from the LOLA terrain model and JPL Horizons.')));
    } else if (!data.site.coordinate_origin.verified) {
      nodes.push(el('p', 'warning', t('⚠ Approximate position, pending verification against the original source.')));
    } else {
      const area = data.site.area_km2 ? ` ${t('Region area: {area} km².', { area: data.site.area_km2 })}` : '';
      nodes.push(el('p', 'muted', t('Centre of the region area (USGS grid), not a selected landing point.') + area));
    }

    nodes.push(...(this.mode === 'educational' ? this.educational(data) : this.expert(data)));
    const sources = el('ul', 'sources');
    for (const source of data.sources) sources.append(el('li', '', t(source.name)));
    const comparison = this.comparison(data);
    if (this.mode === 'expert') {
      if (comparison.length > 0) nodes.push(this.block('Compare with another region', comparison));
      nodes.push(this.block('Sources', [sources]));
    } else {
      if (comparison.length > 0) nodes.push(el('h3', '', t('Compare with another region')), ...comparison);
      nodes.push(el('h3', '', t('Sources')), sources);
    }
    nodes.push(el('p', 'disclaimer', t('Geometric visibility only, for one point and one period. Not a certification for space missions.')));

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
    nodes.push(el('h3', '', t('What happens here in {days} days', { days })));
    nodes.push(card(t('Sunlight (solar power)'), show(sun, '%'),
      t('How much of the time the Sun shines here. Solar panels only make electricity while the Sun is in view.')));
    nodes.push(card(t('Earth in view (radio contact)'), show(earth, '%'),
      t('How much of the time you could see the Earth from here. Radio signals need a clear path to Earth.')));
    nodes.push(card(t('Longest time in the dark'), dark.value === null ? t('no data') : `${num(dark.value)} h`,
      dark.value === null ? '' : t('That is about {days} Earth days in a row with no sunlight. Batteries and heaters must last that long.', { days: num((dark.value / 24).toFixed(1)) })));

    // Gráficos simples (os detalhados ficam no modo Expert).
    nodes.push(el('h3', '', t('Out of every 10 hours…')));
    nodes.push(el('p', 'muted', t('Each coloured dot is one hour with the Sun (or the Earth) in view. Grey dots are hours when the hills hide it.')));
    nodes.push(tenHoursChart(data));

    nodes.push(el('h3', '', t('Day by day')));
    nodes.push(el('p', 'muted', t('One square for each day. The fuller the square, the more hours of that day the Sun (or the Earth) could be seen.')));
    nodes.push(dayCalendar(data));

    nodes.push(el('h3', '', t('Why do hills matter so much?')));
    nodes.push(el('p', 'muted', t('At the Moon\'s south pole the Sun and the Earth always stay low in the sky, close to the ground line. A hill or a crater rim in the way is enough to hide them. That is why two places only a few kilometres apart can be so different.')));
    if (data.site.custom) nodes.push(...this.goodOrBad(sun.value, earth.value, dark.value));
    nodes.push(el('p', 'muted', t('Want every detail? Switch to Expert mode (top of the page) to see the full charts.')));
    return nodes;
  }

  /** Só para pontos livres: o que faz um lugar ser bom ou ruim para pousar, com a leitura deste ponto. */
  private goodOrBad(sun: number | null, earth: number | null, dark: number | null): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    nodes.push(el('h3', '', t('What makes a place good or bad to land?')));
    nodes.push(el('p', 'muted', t('Mission planners look at several things at once. This tool measures the first three.')));
    const row = (name: string, why: string, verdict: string): HTMLElement => {
      const box = el('div', 'edu-card');
      box.append(el('span', 'edu-title', name), el('span', 'edu-big', verdict), el('p', '', why));
      return box;
    };
    const level = (value: number | null): string =>
      value === null ? t('no data') : value >= 50 ? t('Good') : value >= 20 ? t('Medium') : t('Poor');
    nodes.push(row(t('Lots of sunlight'), t('More Sun means more electricity from solar panels and less cold. Good places have it most of the time.'), level(sun)));
    nodes.push(row(t('Earth in view'), t('Without a clear view of the Earth, the crew or the rover cannot talk to home by direct radio.'), level(earth)));
    nodes.push(row(t('Short nights'), t('Long darkness drains batteries and freezes equipment. Shorter dark periods are better.'),
      dark === null ? t('no data') : dark <= 100 ? t('Good') : dark <= 300 ? t('Medium') : t('Poor')));
    nodes.push(el('p', 'muted', t('Not measured here, but just as important: a gentle slope and few boulders (a safe landing), ice nearby for water, and a flat place to move around. A great place on this list can still be unsafe to land on.')));
    nodes.push(el('p', 'muted', t('Good / Medium / Poor is a simple rule of thumb for learning, not a NASA criterion.')));
    return nodes;
  }

  /** Gráficos de uma região, no formato do modo atual (usado na comparação de gráficos). */
  private chartsOf(data: SiteData): HTMLElement[] {
    if (this.mode === 'expert') {
      return [el('p', 'muted', t('Margin above the terrain horizon')), marginChart(data), el('p', 'muted', t('Horizon mask')), panoramaChart(data)];
    }
    return [el('p', 'muted', t('Out of every 10 hours…')), tenHoursChart(data), el('p', 'muted', t('Day by day')), dayCalendar(data)];
  }

  /** Modo Especialista: números com origem, parâmetros, consultas e downloads (cada bloco é retrátil). */
  private expert(data: SiteData): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    const hours = periodHoursOf(data);
    const days = Math.round(hours / 24);
    nodes.push(el('p', 'period-note', t('Forecast for one month: {days} days ({hours} h), from {start} to {end} (UTC). Percentages are shares of this period; the hours are the equivalent time (percentage × {hours} h).',
      { days, hours, start: data.period.start_utc, end: data.period.end_utc })));
    nodes.push(this.block('Visibility over the local horizon', [
      metricRow(t('Time with Sun in view'), data.metrics.sun_time_pct, '%', hours),
      metricRow(t('Time with Earth in view'), data.metrics.earth_time_pct, '%', hours),
      metricRow(t('Longest period without Sun'), data.metrics.longest_no_sun_h, 'h'),
      metricRow(t('Mean slope'), data.metrics.mean_slope_deg, '°'),
    ]));
    nodes.push(this.block('Margin above the terrain horizon', [
      el('p', 'muted', t('Body elevation minus terrain elevation at the same azimuth, in degrees. Bars: periods with positive margin.')),
      marginChart(data),
    ]));
    nodes.push(this.block('Horizon mask', [
      el('p', 'muted', t('Terrain elevation angle by azimuth (lunar curvature included), with the Sun and Earth tracks for the period.')),
      panoramaChart(data),
    ]));

    // Parâmetros do cálculo: tudo que alguém precisa para reproduzir o resultado.
    const h = data.horizon;
    const params: [string, string][] = [
      [t('Period (UTC)'), t('{start} to {end}', { start: data.period.start_utc, end: data.period.end_utc })],
      [t('Time step'), `${data.period.step_min} min`],
      [t('Observer height'), t('{h} m above ground', { h: data.site.observer_height_m })],
      [t('Ground height'), data.site.ground_height_m === undefined ? t('no data') : t('{h} m (sphere R = 1737.4 km)', { h: data.site.ground_height_m })],
      [t('DEM'), h.dem.product ? `${h.dem.product}, ${h.dem.resolution_m} m/pixel` : t('no data')],
      [t('Scan radius'), h.max_radius_km === null ? t('no data') : `${h.max_radius_km} km`],
      [t('Shortest DEM reach'), h.min_data_reach_km === undefined ? t('no data') : t('{d} km (DEM edge)', { d: h.min_data_reach_km })],
      [t('Visibility criterion'), h.visibility_criterion === 'disc_center' ? t('centre of the disc above the terrain') : t('any part of the disc above the terrain')],
    ];
    const table = el('dl', 'params');
    for (const [name, value] of params) table.append(el('dt', '', name), el('dd', '', value));
    nodes.push(this.block('Parameters', [table]));

    if (data.queries) {
      const list = el('ul', 'sources');
      for (const [name, url] of [[t('Sun'), data.queries.sun], [t('Earth'), data.queries.earth]]) {
        const item = el('li');
        const link = el('a', '', t('{name}: open the exact query', { name }));
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        item.append(link);
        list.append(item);
      }
      nodes.push(this.block('JPL Horizons queries', [list]));
    }

    nodes.push(this.block('Download data', [
      el('p', 'muted', t('Choose which data of this site to download. Each item shows its origin.')),
      downloadTool(data),
    ]));
    return nodes;
  }

  /** Comparação lado a lado com outra região (mesmos números dos painéis individuais). */
  private comparison(data: SiteData): HTMLElement[] {
    const others = this.sites.filter((s) => s.id !== data.site.id);
    if (others.length === 0) return [];
    const nodes: HTMLElement[] = [];

    const select = el('select', 'compare-select');
    select.setAttribute('aria-label', t('Region to compare with'));
    select.append(new Option(t('Choose a region…'), ''));
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
        [t('Sun in view'), data.metrics.sun_time_pct, b.metrics.sun_time_pct, '%'],
        [t('Earth in view'), data.metrics.earth_time_pct, b.metrics.earth_time_pct, '%'],
        [t('Longest period without Sun'), data.metrics.longest_no_sun_h, b.metrics.longest_no_sun_h, 'h'],
      ];
      for (const [label, ma, mb, unit] of rows) {
        const tr = el('tr');
        const cell = (m: Metric, d: SiteData): string => (unit === '%' ? showPctHours(m, periodHoursOf(d)) : show(m, unit));
        tr.append(el('th', '', label), el('td', '', cell(ma, data)), el('td', '', cell(mb, b)));
        table.append(tr);
      }
      nodes.push(table);
      // Opção de comparar os gráficos das duas regiões, um sobre o outro.
      const toggle = el('label', 'compare-charts');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = this.compareCharts;
      box.addEventListener('change', () => {
        this.compareCharts = box.checked;
        if (this.current === data) this.render();
      });
      toggle.append(box, document.createTextNode(` ${t('Compare the charts')}`));
      nodes.push(toggle);
      if (this.compareCharts) {
        nodes.push(el('h4', 'compare-name', data.site.name), ...this.chartsOf(data), el('h4', 'compare-name', b.site.name), ...this.chartsOf(b));
      }
      // Comparar períodos diferentes seria enganoso: avisamos se não forem iguais.
      if (b.period.start_utc !== data.period.start_utc || b.period.end_utc !== data.period.end_utc) {
        nodes.push(el('p', 'warning', t('⚠ The two regions were computed for different periods.')));
      }
      if (b.fictitious) nodes.push(el('p', 'warning', t('⚠ {name}: FICTITIOUS DATA.', { name: b.site.name })));
    }
    return nodes;
  }
}
