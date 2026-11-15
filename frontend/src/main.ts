// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Ponto de entrada do site. Monta o mapa e liga as três partes da tela:
//   lista de regiões (esquerda) ↔ marcadores no mapa (centro) ↔ painel do local (direita)
// Escolher uma região em qualquer lugar atualiza os outros dois.

import 'leaflet/dist/leaflet.css';
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
  const modeButtons = document.querySelectorAll<HTMLButtonElement>('[data-mode]');
  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      panel.setMode(button.dataset.mode as Mode);
      for (const b of modeButtons) b.setAttribute('aria-pressed', String(b === button));
    });
  }

  // Guarda qual foi o último pedido: se o usuário clicar em duas regiões rápido,
  // a resposta atrasada da primeira não pode sobrescrever a da segunda.
  let lastRequest = 0;

  async function selectSite(site: SiteSummary): Promise<void> {
    const request = ++lastRequest;
    clearCustomMarker();
    siteLayer.highlight(site.id);
    siteList.highlight(site.id);
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
      // Se o usuário clicou em outro lugar enquanto calculava, descartamos este resultado.
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
