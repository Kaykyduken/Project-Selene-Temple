// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Ferramenta de download do modo Expert: o usuário escolhe QUAIS dados do local
// selecionado quer baixar e em que formato. Cada tipo de dado diz de onde vem:
//   - posições do Sol e da Terra → API do JPL Horizons (NASA/JPL)
//   - perfil do horizonte        → modelo de relevo LOLA (NASA PDS); é um arquivo
//                                  de dados da NASA, não uma API
//   - visibilidade e métricas    → calculadas pelo projeto a partir dos dois acima
// Nada aqui é inventado: se o local tiver dado fictício, o arquivo sai marcado.

import type { SiteData } from '../data/contract';
import { margins } from '../charts/svg';
import { t } from '../i18n';

interface DataType {
  key: 'sun' | 'earth' | 'horizon' | 'visibility' | 'summary';
  label: string;
  source: string;
}

const TYPES: DataType[] = [
  { key: 'sun', label: t('Sun position (azimuth, elevation)'), source: t('JPL Horizons API') },
  { key: 'earth', label: t('Earth position (azimuth, elevation)'), source: t('JPL Horizons API') },
  { key: 'horizon', label: t('Terrain horizon profile (360°)'), source: t('LOLA terrain model, NASA PDS') },
  { key: 'visibility', label: t('Visibility and margin over the terrain'), source: t('derived from Horizons + LOLA') },
  { key: 'summary', label: t('Metrics, parameters and Horizons queries'), source: t('derived; includes the exact API queries') },
];

/** Faz o navegador baixar um texto como arquivo. */
function save(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Tabela da série temporal, só com as colunas dos tipos escolhidos. */
function seriesCsv(data: SiteData, pick: Set<string>): string | null {
  if (!pick.has('sun') && !pick.has('earth') && !pick.has('visibility')) return null;
  const m = margins(data);
  const head = ['t_utc'];
  if (pick.has('sun')) head.push('sun_az_deg', 'sun_el_deg');
  if (pick.has('earth')) head.push('earth_az_deg', 'earth_el_deg');
  if (pick.has('visibility')) head.push('sun_margin_deg', 'sun_visible', 'earth_margin_deg', 'earth_visible');
  const lines = data.series.map((p, i) => {
    const row: (string | number | boolean)[] = [p.t_utc];
    if (pick.has('sun')) row.push(p.sun.az_deg, p.sun.el_deg);
    if (pick.has('earth')) row.push(p.earth.az_deg, p.earth.el_deg);
    if (pick.has('visibility')) row.push(m.sun[i].toFixed(3), p.sun.visible, m.earth[i].toFixed(3), p.earth.visible);
    return row.join(',');
  });
  return `${comment(data)}${head.join(',')}\n${lines.join('\n')}\n`;
}

/** Tabela do horizonte: uma linha por azimute. */
function horizonCsv(data: SiteData): string {
  const h = data.horizon;
  const far = h.blocker_distance_km;
  const head = far ? 'azimuth_deg,terrain_elevation_deg,terrain_distance_km' : 'azimuth_deg,terrain_elevation_deg';
  const lines = h.elevation_deg.map((v, i) => [i * h.azimuth_step_deg, v, ...(far ? [far[i]] : [])].join(','));
  return `${comment(data)}${head}\n${lines.join('\n')}\n`;
}

/** Linhas de comentário no topo do CSV: local, fontes e aviso de dado fictício. */
function comment(data: SiteData): string {
  const lines = [
    `# ${data.site.name}: lat ${data.site.lat_deg} deg, east lon ${data.site.lon_deg} deg, observer ${data.site.observer_height_m} m above ground`,
    `# Sources: ${data.sources.map((s) => s.name).join('; ')}`,
  ];
  if (data.fictitious) lines.unshift('# FICTITIOUS DATA');
  return lines.join('\n') + '\n';
}

/** JSON só com as partes escolhidas. */
function toJson(data: SiteData, pick: Set<string>): string {
  const m = margins(data);
  const out: Record<string, unknown> = { site: data.site, period: data.period, sources: data.sources, fictitious: data.fictitious };
  if (pick.has('sun') || pick.has('earth') || pick.has('visibility')) {
    out.series = data.series.map((p, i) => ({
      t_utc: p.t_utc,
      ...(pick.has('sun') ? { sun: { az_deg: p.sun.az_deg, el_deg: p.sun.el_deg } } : {}),
      ...(pick.has('earth') ? { earth: { az_deg: p.earth.az_deg, el_deg: p.earth.el_deg } } : {}),
      ...(pick.has('visibility')
        ? { visibility: { sun_margin_deg: Number(m.sun[i].toFixed(3)), sun_visible: p.sun.visible, earth_margin_deg: Number(m.earth[i].toFixed(3)), earth_visible: p.earth.visible } }
        : {}),
    }));
  }
  if (pick.has('horizon')) out.horizon = data.horizon;
  if (pick.has('summary')) {
    out.metrics = data.metrics;
    out.queries = data.queries ?? null;
    if (!pick.has('horizon')) {
      const { elevation_deg: _e, blocker_distance_km: _b, ...parameters } = data.horizon; // parâmetros sem as listas longas
      out.horizon_parameters = parameters;
    }
  }
  return JSON.stringify(out, null, 1);
}

/** Monta a caixa "Download data" com os filtros. */
export function downloadTool(data: SiteData): HTMLElement {
  const box = document.createElement('form');
  box.className = 'download-tool';
  box.addEventListener('submit', (e) => e.preventDefault());

  const checks = new Map<string, HTMLInputElement>();
  for (const type of TYPES) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = type.key !== 'summary';
    const text = document.createElement('span');
    text.textContent = type.label;
    const source = document.createElement('small');
    source.textContent = type.source;
    label.append(input, text, source);
    box.append(label);
    checks.set(type.key, input);
  }

  const row = document.createElement('div');
  row.className = 'actions';
  const format = document.createElement('select');
  format.setAttribute('aria-label', t('File format'));
  format.append(new Option(t('CSV (tables)'), 'csv'), new Option('JSON', 'json'));
  format.className = 'compare-select';
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = t('Download');
  const status = document.createElement('p');
  status.className = 'muted';
  status.setAttribute('aria-live', 'polite');
  row.append(format, button);
  box.append(row, status);

  button.addEventListener('click', () => {
    const pick = new Set([...checks].filter(([, input]) => input.checked).map(([key]) => key));
    if (pick.size === 0) {
      status.textContent = t('Choose at least one type of data.');
      return;
    }
    const base = data.site.id;
    if (format.value === 'json') {
      save(`${base}.json`, toJson(data, pick), 'application/json');
      status.textContent = t('Downloaded 1 file.');
      return;
    }
    // CSV: a série temporal e o horizonte são tabelas diferentes, então saem em arquivos separados.
    const files: [string, string][] = [];
    const series = seriesCsv(data, pick);
    if (series) files.push([`${base}_time_series.csv`, series]);
    if (pick.has('horizon')) files.push([`${base}_horizon.csv`, horizonCsv(data)]);
    for (const [name, text] of files) save(name, text, 'text/csv');
    if (pick.has('summary')) save(`${base}_summary.json`, toJson(data, new Set(['summary'])), 'application/json');
    const count = files.length + (pick.has('summary') ? 1 : 0);
    status.textContent = count === 1 ? t('Downloaded 1 file.') : t('Downloaded {count} files.', { count });
  });

  return box;
}
