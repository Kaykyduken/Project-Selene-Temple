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
import { loadSiteCatalog, loadSiteData } from './data/loader';
import type { SiteSummary } from './data/contract';
import { checkApiHealth } from './api';

const map = createPolarMap('map');
addGraticule(map);

const panel = new SitePanel(document.getElementById('site-panel')!);
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
  const catalog = await loadSiteCatalog();

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
  const siteList = new SiteList(document.getElementById('site-list')!, catalog.sites, (site) => {
    // Pela lista, o mapa também se move até a região.
    map.flyTo([site.lat_deg, site.lon_deg], Math.max(map.getZoom(), 4));
    void selectSite(site);
  });

  // Clique em qualquer outro lugar do mapa → ponto livre com lat/lon.
  map.on('click', (e) => {
    lastRequest++;
    siteLayer.highlight(null);
    siteList.highlight(null);
    clearCustomMarker();
    // circleMarker em vez do "pino" padrão do Leaflet: o pino depende de arquivos de
    // imagem que costumam quebrar quando o site é empacotado pelo Vite.
    customMarker = L.circleMarker(e.latlng, { radius: 6, color: '#4da3ff', weight: 3, fillOpacity: 0.2, interactive: false }).addTo(map);
    panel.showCustomPoint(e.latlng.lat, e.latlng.lng);
  });
}

start().catch(() => {
  document.getElementById('site-list')!.textContent = 'Could not load the list of regions.';
});

// Selo "API: online/offline" no topo da página.
const apiBadge = document.getElementById('api-status')!;
checkApiHealth().then((ok) => {
  apiBadge.textContent = ok ? 'API: online' : 'API: offline (static mode)';
  apiBadge.className = `badge ${ok ? 'badge-ok' : 'badge-off'}`;
});
