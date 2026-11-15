// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Gráficos SIMPLES do modo Educational, pensados para um aluno do fim do
// ensino fundamental entender de primeira:
//   1. "10 bolinhas": de cada 10 horas, em quantas o Sol (ou a Terra) aparece.
//   2. "Calendário": um quadradinho por dia; quanto mais cheio, mais horas
//      daquele dia o Sol (ou a Terra) ficou à vista.
// Usam os MESMOS dados dos gráficos do modo Expert, só com outra apresentação.

import type { SiteData } from '../data/contract';
import { COLOR } from './svg';

type Body = 'sun' | 'earth';
const NAME: Record<Body, string> = { sun: 'Sun', earth: 'Earth' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Fileira de 10 bolinhas: as cheias mostram "em quantas de cada 10 horas". */
function dotsRow(body: Body, pct: number | null): HTMLElement {
  const row = el('div', 'dots-row');
  row.append(el('span', 'dots-name', NAME[body]));
  const dots = el('span', 'dots');
  const filled = pct === null ? 0 : Math.round(pct / 10);
  for (let i = 0; i < 10; i++) {
    const dot = el('span', 'dot');
    if (i < filled) dot.style.background = COLOR[body];
    dots.append(dot);
  }
  row.append(dots);
  row.append(el('span', 'dots-text', pct === null ? 'no data' : `about ${filled} of every 10 hours`));
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', pct === null ? `${NAME[body]}: no data` : `${NAME[body]} in view about ${filled} of every 10 hours`);
  return row;
}

export function tenHoursChart(data: SiteData): HTMLElement {
  const box = el('div', 'simple-chart');
  box.append(dotsRow('sun', data.metrics.sun_time_pct.value), dotsRow('earth', data.metrics.earth_time_pct.value));
  return box;
}

interface Day {
  label: string; // "Jan 5"
  hours: number; // horas com dado nesse dia
  sun: number; // horas com o Sol à vista
  earth: number;
}

/** Junta a série (de hora em hora) em dias. Dias quase sem dados ficam de fora. */
function groupByDay(data: SiteData): Day[] {
  const stepHours = data.period.step_min / 60;
  const days = new Map<string, Day>();
  for (const point of data.series) {
    const key = point.t_utc.slice(0, 10);
    let day = days.get(key);
    if (!day) {
      const date = new Date(`${key}T00:00:00Z`);
      day = { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), hours: 0, sun: 0, earth: 0 };
      days.set(key, day);
    }
    day.hours += stepHours;
    if (point.sun.visible) day.sun += stepHours;
    if (point.earth.visible) day.earth += stepHours;
  }
  return [...days.values()].filter((day) => day.hours >= 12);
}

/** Calendário: uma linha para o Sol e outra para a Terra, um quadradinho por dia. */
export function dayCalendar(data: SiteData): HTMLElement {
  const box = el('div', 'simple-chart');
  const days = groupByDay(data);
  if (days.length === 0) {
    box.append(el('p', 'muted', 'No data.'));
    return box;
  }
  const info = el('p', 'calendar-info', 'Point at a square (or tap it) to see that day.');
  info.setAttribute('aria-live', 'polite');

  for (const body of ['sun', 'earth'] as Body[]) {
    const row = el('div', 'calendar-row');
    row.append(el('span', 'dots-name', NAME[body]));
    const cells = el('div', 'calendar-cells');
    days.forEach((day, index) => {
      const hours = Math.round(day[body]);
      const total = Math.round(day.hours);
      const cell = el('button', 'calendar-cell');
      cell.type = 'button';
      const fill = el('span', 'calendar-fill');
      fill.style.height = `${(day[body] / day.hours) * 100}%`;
      fill.style.background = COLOR[body];
      cell.append(fill);
      const text = `Day ${index + 1} (${day.label}): ${NAME[body]} in view for ${hours} of ${total} hours`;
      cell.setAttribute('aria-label', text);
      const tell = (): void => {
        info.textContent = text;
      };
      cell.addEventListener('pointerenter', tell);
      cell.addEventListener('focus', tell);
      cell.addEventListener('click', tell);
      cells.append(cell);
    });
    row.append(cells);
    box.append(row);
  }

  // Régua dos dias: primeiro, a cada 5 e o último.
  const ruler = el('div', 'calendar-row');
  ruler.append(el('span', 'dots-name', 'Day'));
  const numbers = el('div', 'calendar-cells calendar-numbers');
  days.forEach((_, index) => {
    const n = index + 1;
    numbers.append(el('span', '', n === 1 || n % 5 === 0 ? String(n) : ''));
  });
  ruler.append(numbers);
  box.append(ruler);

  const key = el('p', 'muted calendar-key');
  const full = el('span', 'calendar-cell calendar-sample');
  const fullFill = el('span', 'calendar-fill');
  fullFill.style.height = '100%';
  fullFill.style.background = COLOR.sun;
  full.append(fullFill);
  const empty = el('span', 'calendar-cell calendar-sample');
  key.append(full, ' full square = in view all day ', empty, ' empty square = hidden all day');
  box.append(key, info);
  return box;
}
