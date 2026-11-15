// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Tour guiado: escurece a página, destaca uma parte por vez e explica o que ela faz.
// Os passos abrem os painéis e trocam a vista (Lua 3D / mapa) sozinhos, para o usuário
// só precisar apertar "Next". Aparece sozinho na primeira visita e pode ser repetido
// pelo botão "Guided tour" no topo.

import { t } from './i18n';

interface Step {
  /** Elemento destacado; sem ele, o passo é uma mensagem no centro da tela. */
  target?: string;
  title: string;
  text: string;
  /** Prepara a tela (abre painel, troca de vista) antes de mostrar o passo. */
  before?: () => void;
}

const SEEN_KEY = 'llsn-tour-seen';

function click(selector: string): void {
  document.querySelector<HTMLElement>(selector)?.click();
}
function setPanel(id: 'left-panel' | 'right-panel', open: boolean): void {
  const panel = document.getElementById(id);
  if (panel && panel.classList.contains('collapsed') === open) click(`.collapse-btn[data-collapse="${id}"]`);
}
function setView(view: 'map' | 'globe'): void {
  click(`.view-toggle button[data-view="${view}"]`);
}

function steps(): Step[] {
  return [
    {
      title: t('Welcome!'),
      text: t('This site compares places near the Moon\'s south pole as possible landing sites: how much Sun they get, whether the Earth can be seen, and how long the dark lasts. This 1-minute tour shows how to use it.'),
      before: () => {
        click('.mode-toggle button[data-mode="educational"]');
        setPanel('left-panel', false);
        setPanel('right-panel', false);
        setView('globe');
      },
    },
    {
      target: '.view-toggle',
      title: t('Two ways to look'),
      text: t('"3D Moon" is a globe you can spin. "Map" is a flat view of the south pole. You can switch between them at any time.'),
    },
    {
      target: '#globe',
      title: t('The 3D Moon'),
      text: t('Drag to spin the Moon and scroll to zoom. Orange dots are candidate landing regions near the south pole. Teal diamonds are the places where the Apollo astronauts landed. Names are shown next to them.'),
      before: () => setView('globe'),
    },
    {
      target: '#left-panel',
      title: t('Candidate regions'),
      text: t('This list has the regions NASA named for study. The two columns show the share of time with Sun and with Earth in view. Click one to see its details.'),
      before: () => {
        setPanel('right-panel', false);
        setPanel('left-panel', true);
      },
    },
    {
      target: '#left-panel details.section:nth-of-type(2)',
      title: t('Historic landmarks'),
      text: t('Click an Apollo mission here. The Moon turns and zooms to the landing site, and a window opens with the story and official NASA photos. Click a photo to enlarge it.'),
    },
    {
      target: '#map',
      title: t('Analyse any point'),
      text: t('On the map, click anywhere inside the red border to analyse that exact spot (80°S to the pole). Outside the border there is no terrain data yet. The calculation takes a few seconds.'),
      before: () => {
        setPanel('left-panel', false);
        setView('map');
      },
    },
    {
      target: '#right-panel',
      title: t('The results'),
      text: t('The answer appears here: how much Sun, how much Earth, the longest dark period, and simple charts. For your own points, the end of the panel explains what makes a place good or bad to land.'),
      before: () => setPanel('right-panel', true),
    },
    {
      target: '.topbar-right .mode-toggle:nth-child(2)',
      title: t('Educational or Expert'),
      text: t('Educational explains everything in simple words. Expert shows the detailed charts, parameters and sources for people who want to check the numbers.'),
    },
    {
      target: '.size-toggle',
      title: t('Text size'),
      text: t('Five sizes of "A": pick the one that is comfortable to read. The site remembers your choice.'),
    },
    {
      target: '.lang-toggle',
      title: t('Language'),
      text: t('Switch between English and Portuguese here.'),
    },
    {
      title: t('You are ready!'),
      text: t('Pick a region, an Apollo landmark or a point on the map and explore. You can repeat this tour any time with the "Guided tour" button at the top.'),
      before: () => {
        setPanel('right-panel', false);
        setView('globe');
      },
    },
  ];
}

export function startTour(): void {
  if (document.querySelector('.tour-block')) return;
  const list = steps();
  let index = 0;

  const block = document.createElement('div');
  block.className = 'tour-block'; // impede cliques na página durante o tour
  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  document.body.append(block, spot, card);

  const place = (): void => {
    const step = list[index];
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!target) {
      spot.style.display = 'none';
      block.classList.add('dim');
      card.style.left = `${Math.max(margin, (vw - card.offsetWidth) / 2)}px`;
      card.style.top = `${Math.max(margin, (vh - card.offsetHeight) / 2)}px`;
      return;
    }
    block.classList.remove('dim');
    const r = target.getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.left = `${r.left - 4}px`;
    spot.style.top = `${r.top - 4}px`;
    spot.style.width = `${r.width + 8}px`;
    spot.style.height = `${r.height + 8}px`;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    let left: number;
    let top: number;
    if (r.width > vw * 0.5 && r.height > vh * 0.5) {
      // Destaque grande (Lua ou mapa): o cartão fica dentro dele, embaixo.
      left = r.left + (r.width - w) / 2;
      top = r.bottom - h - 48;
    } else if (r.bottom + h + margin < vh && r.height < vh * 0.4) {
      left = r.left + r.width / 2 - w / 2; // abaixo (barra do topo)
      top = r.bottom + margin;
    } else if (r.right + w + margin < vw) {
      left = r.right + margin; // à direita (painel da esquerda)
      top = r.top + margin;
    } else {
      left = r.left - w - margin; // à esquerda (painel da direita)
      top = r.top + margin;
    }
    card.style.left = `${Math.min(Math.max(margin, left), vw - w - margin)}px`;
    card.style.top = `${Math.min(Math.max(margin, top), vh - h - margin)}px`;
  };

  const render = (): void => {
    const step = list[index];
    card.replaceChildren();
    const counter = document.createElement('span');
    counter.className = 'tour-counter';
    counter.textContent = `${index + 1} / ${list.length}`;
    const title = document.createElement('h2');
    title.textContent = step.title;
    const text = document.createElement('p');
    text.textContent = step.text;
    const buttons = document.createElement('div');
    buttons.className = 'tour-buttons';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'tour-skip';
    skip.textContent = t('Skip');
    skip.addEventListener('click', finish);
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = t('Back');
    back.disabled = index === 0;
    back.addEventListener('click', () => go(index - 1));
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'tour-next';
    next.textContent = index === list.length - 1 ? t('Finish') : t('Next');
    next.addEventListener('click', () => (index === list.length - 1 ? finish() : go(index + 1)));
    buttons.append(skip, back, next);
    card.append(counter, title, text, buttons);
    next.focus();
  };

  const go = (to: number): void => {
    index = to;
    list[index].before?.();
    render();
    // Painéis e vistas levam um instante para mudar de tamanho: posiciona depois.
    place();
    window.setTimeout(place, 150);
    window.setTimeout(place, 500);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight' && index < list.length - 1) go(index + 1);
    else if (e.key === 'ArrowLeft' && index > 0) go(index - 1);
  };
  function finish(): void {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignora */
    }
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', place);
    block.remove();
    spot.remove();
    card.remove();
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', place);
  go(0);
}

/** Liga o botão do topo e abre o tour sozinho na primeira visita. */
export function setupTour(): void {
  document.getElementById('tour-btn')?.addEventListener('click', startTour);
  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    /* sem armazenamento: não insiste */
    seen = true;
  }
  if (!seen) window.setTimeout(startTour, 1200);
}
