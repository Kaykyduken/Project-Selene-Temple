// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Ponto de entrada do site. Monta o mapa e liga as três partes da tela:
//   lista de regiões (esquerda) ↔ marcadores no mapa (centro) ↔ painel do local (direita)
// Escolher uma região em qualquer lugar atualiza os outros dois.

import 'leaflet/dist/leaflet.css';
// Fonte do modo Educational, embutida no site (funciona sem internet).
// O modo Expert usa Calibri quando o computador tem (Windows/Office) e Arial
// nos demais; essas duas são fontes do sistema e não vão junto com o site.
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import './style.css';
import L from 'leaflet';
import { createPolarMap } from './map/polarMap';
import { addGraticule } from './map/graticule';
import { loadBasemap } from './map/basemap';
import { SiteLayer } from './map/sites';
import { SiteList } from './panels/siteList';
import { SitePanel } from './panels/sitePanel';
import { loadSiteCatalog, loadSiteData, loadSummary } from './data/loader';
import type { Mode, SiteSummary } from './data/contract';
import { analyzePoint, checkApiHealth } from './api';
import { Favorites, MAX_FAVORITES } from './favorites';
import { formatLatLon } from './panels/sitePanel';
import type { SiteData } from './data/contract';
import type { MoonGlobe } from './globe/moonGlobe';

// Pergunta uma vez se a API está no ar; a resposta é reaproveitada no clique do mapa.
const apiOnline = checkApiHealth();

const map = createPolarMap('map');
addGraticule(map);

const basemapStatus = document.getElementById('basemap-status')!;
loadBasemap(map).then((message) => {
  basemapStatus.textContent = message;
});

// Marcador do ponto livre (clique fora das regiões). Só existe um por vez.
let customMarker: L.CircleMarker | null = null;
function clearCustomMarker(): void {
  customMarker?.remove();
  customMarker = null;
}

async function start(): Promise<void> {
  // Catálogo (lista de regiões) e resumo (métricas para a comparação) em paralelo.
  const [catalog, summary] = await Promise.all([loadSiteCatalog(), loadSummary()]);
  const panel = new SitePanel(document.getElementById('site-panel')!, catalog.sites, loadSiteData);

  // Botões Educational / Expert no topo: trocam a apresentação, não os números.
  const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-toggle button[data-mode]');
  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      panel.setMode(button.dataset.mode as Mode);
      document.body.dataset.mode = button.dataset.mode; // o CSS troca a fonte conforme o modo
      for (const b of modeButtons) b.setAttribute('aria-pressed', String(b === button));
      // A Lua 3D é só do modo Educational: no Expert voltamos ao mapa.
      if (button.dataset.mode === 'expert') void showView('map');
    });
  }

  // ---------- Vista: mapa ou Lua 3D (só no modo Educational) ----------
  const mapElement = document.getElementById('map')!;
  const globeElement = document.getElementById('globe')!;
  const viewButtons = document.querySelectorAll<HTMLButtonElement>('.view-toggle button');
  let globe: MoonGlobe | null = null;
  let globeFailed = false;

  async function showView(view: 'map' | 'globe'): Promise<void> {
    for (const b of viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    if (view === 'map') {
      globe?.stop();
      globeElement.classList.add('is-hidden');
      mapElement.classList.remove('is-hidden');
      map.invalidateSize(); // o mapa estava escondido: recalcula o tamanho
      return;
    }
    mapElement.classList.add('is-hidden');
    globeElement.classList.remove('is-hidden');
    if (!globe && !globeFailed) {
      globeElement.textContent = 'Loading the 3D Moon…';
      try {
        // Import dinâmico: o Three.js só é baixado agora.
        const { MoonGlobe: Globe } = await import('./globe/moonGlobe');
        globe = await Globe.create(globeElement, catalog.sites, (site) => void selectSite(site));
        if (currentSiteId) globe.highlight(currentSiteId);
      } catch {
        globeFailed = true; // por exemplo, navegador sem WebGL
        globeElement.textContent = '';
        globeElement.classList.add('is-hidden');
        mapElement.classList.remove('is-hidden');
        map.invalidateSize();
        for (const b of viewButtons) b.setAttribute('aria-pressed', String(b.dataset.view === 'map'));
        basemapStatus.textContent = 'The 3D Moon needs WebGL, which is not available in this browser. Showing the map instead.';
        return;
      }
    }
    globe?.start();
  }
  for (const b of viewButtons) b.addEventListener('click', () => void showView(b.dataset.view as 'map' | 'globe'));

  // ---------- Favoritos ----------
  // Pontos livres guardados pelo usuário. Cada um tem um marcador amarelo fixo no mapa.
  const favorites = new Favorites();
  const favoriteMarkers = L.layerGroup().addTo(map);
  const favoriteBox = document.getElementById('favorites')!;

  function openFavorite(data: SiteData): void {
    lastRequest++;
    clearCustomMarker();
    siteLayer.highlight(null);
    siteList.highlight(null);
    globe?.highlight(null);
    map.flyTo([data.site.lat_deg, data.site.lon_deg], Math.max(map.getZoom(), 4));
    panel.showSite(data); // usa os dados guardados: não recalcula
  }

  function drawFavorites(): void {
    favoriteMarkers.clearLayers();
    const where = document.createElement('p');
    where.className = 'muted';
    where.textContent = favorites.where();
    if (favorites.list().length === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No favorite points yet. Analyse a point on the map and add it here to keep it.';
      favoriteBox.replaceChildren(empty, where);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'fav-list';
    for (const data of favorites.list()) {
      L.circleMarker([data.site.lat_deg, data.site.lon_deg], { radius: 6, color: '#e7c84a', weight: 2, fillColor: '#e7c84a', fillOpacity: 0.5 })
        .bindTooltip(data.site.name)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          openFavorite(data);
        })
        .addTo(favoriteMarkers);
      const item = document.createElement('li');
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = data.site.name;
      open.addEventListener('click', () => openFavorite(data));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `Remove ${data.site.name} from Favorites`);
      remove.addEventListener('click', () => favorites.remove(data.site.id));
      item.append(open, remove);
      list.append(item);
    }
    favoriteBox.replaceChildren(list, where);
  }
  favorites.onChange = drawFavorites;
  favorites.onError = (message) => {
    const warning = document.createElement('p');
    warning.className = 'warning';
    warning.textContent = message;
    favoriteBox.append(warning);
  };

  // O painel usa isto para desenhar o botão de estrela e para adicionar/remover.
  panel.favorites = {
    has: (id) => favorites.has(id),
    toggle: (data) => {
      if (favorites.has(data.site.id)) {
        favorites.remove(data.site.id);
        return null;
      }
      return favorites.add(data) ? null : `Favorites is full (${MAX_FAVORITES} points). Remove one first.`;
    },
  };

  // Guarda qual foi o último pedido: se o usuário clicar em duas regiões rápido,
  // a resposta atrasada da primeira não pode sobrescrever a da segunda.
  let lastRequest = 0;
  let currentSiteId: string | null = null; // região aberta, para destacar na Lua 3D ao abri-la

  async function selectSite(site: SiteSummary): Promise<void> {
    const request = ++lastRequest;
    currentSiteId = site.id;
    clearCustomMarker();
    siteLayer.highlight(site.id);
    siteList.highlight(site.id);
    globe?.highlight(site.id);
    panel.showLoading(site.name);
    try {
      const data = await loadSiteData(site.id);
      if (request === lastRequest) panel.showSite(data);
    } catch {
      if (request === lastRequest) panel.showError(site.name);
    }
  }

  const siteLayer = new SiteLayer(map, catalog.sites, selectSite);
  const siteList = new SiteList(document.getElementById('site-list')!, catalog.sites, summary, (site) => {
    // Pela lista, o mapa também se move até a região.
    map.flyTo([site.lat_deg, site.lon_deg], Math.max(map.getZoom(), 4));
    void selectSite(site);
  });

  // Ao abrir o site: lê os favoritos do arquivo (se a API estiver ligada).
  void apiOnline.then((ok) => favorites.load(ok));

  // Clique em qualquer outro lugar do mapa → ponto livre.
  // Com a API ligada (computador da equipe), o ponto é calculado ao vivo.
  // Sem a API (site publicado), mostramos só as coordenadas e "no data".
  map.on('click', async (e) => {
    const request = ++lastRequest;
    const { lat, lng } = e.latlng;
    siteLayer.highlight(null);
    siteList.highlight(null);
    clearCustomMarker();
    // circleMarker em vez do "pino" padrão do Leaflet: o pino depende de arquivos de
    // imagem que costumam quebrar quando o site é empacotado pelo Vite.
    customMarker = L.circleMarker(e.latlng, { radius: 6, color: '#4da3ff', weight: 3, fillOpacity: 0.2, interactive: false }).addTo(map);

    if (!(await apiOnline)) {
      if (request === lastRequest) panel.showCustomPoint(lat, lng, 'No data: live analysis of custom points needs the project API, which is not running here.');
      return;
    }
    if (lat > -80) {
      panel.showCustomPoint(lat, lng, 'No data: the terrain model covers only 80°S to the pole.');
      return;
    }
    panel.showCustomPoint(lat, lng, 'Computing the horizon and the visibility… this takes a few seconds.');
    try {
      const data = await analyzePoint(lat, lng);
      // Identifica o ponto pelas coordenadas, para os Favoritos e para o nome dos arquivos baixados.
      data.site.id = `point_${Math.abs(lat).toFixed(4)}S_${(((lng % 360) + 360) % 360).toFixed(4)}E`;
      data.site.name = `Point ${formatLatLon(lat, lng)}`;
      // Se o usuário clicou em outro lugar enquanto calculava, descartamos este resultado.
      // O resultado NÃO é guardado em lugar nenhum: fica só no painel. Ao clicar em
      // outro ponto ele é substituído e se perde, a menos que esteja nos Favoritos.
      if (request === lastRequest) panel.showSite(data);
    } catch (err) {
      if (request === lastRequest) panel.showCustomPoint(lat, lng, `No data: ${(err as Error).message}`, true);
    }
  });
}

start().catch(() => {
  document.getElementById('site-list')!.textContent = 'Could not load the list of regions.';
});

// Selo "API: online/offline" no topo da página.
const apiBadge = document.getElementById('api-status')!;
apiOnline.then((ok) => {
  apiBadge.textContent = ok ? 'API: online' : 'API: offline (static mode)';
  apiBadge.className = `badge ${ok ? 'badge-ok' : 'badge-off'}`;
});
