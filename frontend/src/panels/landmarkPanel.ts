// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Janela dos MARCOS HISTÓRICOS (pousos Apollo), no modo Educational.
// Em vez de números de Sol/Terra, mostra:
//   - uma galeria que alterna até 10 fotos do evento
//   - um texto de história, pensado para estudo
// As fotos NÃO ficam guardadas no site: são buscadas na hora no acervo oficial
// NASA Image and Video Library (images.nasa.gov). Sem internet ou se o acervo
// não responder, a janela mostra "no images" e o texto continua funcionando.

import { formatLatLon } from './sitePanel';
import { LANG, t } from '../i18n';

export interface Landmark {
  id: string;
  name: string;
  lander: string;
  place: string;
  lat_deg: number;
  lon_deg: number;
  touchdown_utc: string;
  crew: string;
  image_query: string;
  history: string[];
  study_questions: string[];
  wikipedia?: string; // artigo da Wikipédia (no idioma do site)
}

export interface LandmarkCatalog {
  source: string;
  touchdown_source: string;
  note: string;
  landmarks: Landmark[];
}

export interface Photo {
  title: string;
  date: string;
  preview: string; // endereço da imagem
  page: string; // página da foto no acervo da NASA
}

const MAX_PHOTOS = 10;

/** Em português: títulos das fotos traduzidos (por nasa_id). Carregado uma vez. */
const translatedTitles: Promise<Record<string, string>> =
  LANG === 'pt'
    ? fetch(`${import.meta.env.BASE_URL}data/photo-titles.pt.json`)
        .then((r) => (r.ok ? r.json() : { titles: {} }))
        .then((json) => json.titles ?? {})
        .catch(() => ({}))
    : Promise.resolve({});
const cache = new Map<string, Promise<Photo[]>>(); // uma busca por marco, reaproveitada

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Busca as fotos do evento no acervo da NASA (resposta em JSON). */
export function fetchPhotos(query: string): Promise<Photo[]> {
  const cached = cache.get(query);
  if (cached) return cached;
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=${MAX_PHOTOS}`;
  const request = fetch(url, { signal: AbortSignal.timeout(15_000) })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(async (json) => {
      const titles = await translatedTitles;
      const photos: Photo[] = [];
      for (const item of json?.collection?.items ?? []) {
        const data = item?.data?.[0];
        const preview = (item?.links ?? []).find((link: { href?: string }) => /\.(jpe?g|png)$/i.test(link?.href ?? ''))?.href;
        if (!data?.nasa_id || !preview) continue;
        photos.push({
          // Sem tradução guardada, fica o título original da NASA, com aviso.
          title: titles[data.nasa_id] ?? (LANG === 'pt' ? `${data.title ?? data.nasa_id} ${t('(original NASA title)')}` : String(data.title ?? data.nasa_id)),
          date: String(data.date_created ?? '').slice(0, 10),
          preview,
          page: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}`,
        });
        if (photos.length === MAX_PHOTOS) break;
      }
      return photos;
    });
  request.catch(() => cache.delete(query)); // se falhou, deixa tentar de novo depois
  cache.set(query, request);
  return request;
}

/** Galeria: uma foto por vez, com botões anterior/próxima e contador. */
function gallery(landmark: Landmark): HTMLElement {
  const box = el('div', 'gallery');
  const status = el('p', 'muted', t('Loading images from the NASA Image and Video Library…'));
  box.append(status);

  fetchPhotos(landmark.image_query)
    .then((photos) => {
      if (photos.length === 0) throw new Error('empty');
      let index = 0;
      const frame = el('div', 'gallery-frame');
      const image = el('img');
      const prev = el('button', 'gallery-nav', '‹');
      const next = el('button', 'gallery-nav', '›');
      prev.type = next.type = 'button';
      prev.setAttribute('aria-label', t('Previous image'));
      next.setAttribute('aria-label', t('Next image'));
      const counter = el('span', 'gallery-counter');
      const caption = el('p', 'gallery-caption');
      const link = el('a', 'muted', t('Open on images.nasa.gov'));
      link.target = '_blank';
      link.rel = 'noopener';

      const show = (): void => {
        const photo = photos[index];
        image.src = photo.preview;
        image.alt = photo.title;
        counter.textContent = `${index + 1} / ${photos.length}`;
        caption.textContent = photo.date ? `${photo.title} (${photo.date})` : photo.title;
        link.href = photo.page;
      };
      prev.addEventListener('click', () => {
        index = (index + photos.length - 1) % photos.length;
        show();
      });
      next.addEventListener('click', () => {
        index = (index + 1) % photos.length;
        show();
      });
      frame.append(image);
      const controls = el('div', 'gallery-controls');
      controls.append(prev, counter, next);
      const credit = el('p', 'muted', t('Images: NASA Image and Video Library, loaded live. '));
      credit.append(link);
      box.replaceChildren(frame, controls, caption, credit);
      show();
    })
    .catch(() => {
      status.textContent = t('No images: the NASA Image and Video Library could not be reached. ');
      const link = el('a', '', t('Search it directly'));
      link.href = `https://images.nasa.gov/search?q=${encodeURIComponent(landmark.image_query)}&media=image`;
      link.target = '_blank';
      link.rel = 'noopener';
      status.append(link);
    });
  return box;
}

/** Desenha a janela do marco histórico dentro do painel da direita. */
export function showLandmark(container: HTMLElement, landmark: Landmark, catalog: LandmarkCatalog): void {
  const nodes: HTMLElement[] = [];
  nodes.push(el('p', 'landmark-tag', t('Historic landmark')));
  nodes.push(el('h2', '', `${landmark.name}: ${landmark.place}`));
  nodes.push(el('p', 'coords', formatLatLon(landmark.lat_deg, landmark.lon_deg)));
  nodes.push(el('p', 'muted', t('{lander}. Touchdown: {when}.', { lander: landmark.lander, when: landmark.touchdown_utc.replace('T', ' ').replace('Z', ' UTC') })));
  nodes.push(el('p', 'muted', t('Crew: {crew}.', { crew: landmark.crew })));

  nodes.push(el('h3', '', t('Images of the event')));
  nodes.push(gallery(landmark));

  nodes.push(el('h3', '', t('History')));
  for (const paragraph of landmark.history) nodes.push(el('p', 'edu-text', paragraph));

  if (landmark.wikipedia) {
    const wiki = el('p', 'wiki-link');
    const link = el('a', '', t('Read more on Wikipedia: {name}', { name: landmark.name }));
    link.href = landmark.wikipedia;
    link.target = '_blank';
    link.rel = 'noopener';
    wiki.append(link);
    nodes.push(wiki);
  }

  nodes.push(el('h3', '', t('Questions for study')));
  const list = el('ul', 'study-list');
  for (const question of landmark.study_questions) list.append(el('li', '', question));
  nodes.push(list);

  nodes.push(el('p', 'muted', t('Coordinates: {source}. {note} No Sun/Earth horizon analysis here: the terrain model covers only 80°S to the pole.', { source: catalog.source, note: catalog.note })));
  container.replaceChildren(...nodes);
  container.scrollTop = 0;
}
