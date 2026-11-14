// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Ponto de entrada do site. Monta o mapa, a grade, o mapa-base, mostra as
// coordenadas do clique e testa se a API está respondendo.

import 'leaflet/dist/leaflet.css';
import './style.css';
import { createPolarMap } from './map/polarMap';
import { addGraticule } from './map/graticule';
import { loadBasemap } from './map/basemap';
import { checkApiHealth } from './api';

const map = createPolarMap('map');
addGraticule(map);

// Mapa-base: carrega em segundo plano e avisa na tela se não encontrar.
const basemapStatus = document.getElementById('basemap-status')!;
loadBasemap(map).then((message) => {
  basemapStatus.textContent = message;
});

// Clique no mapa → mostra latitude/longitude e as coordenadas em metros.
// e.latlng já vem convertido pelo Proj4Leaflet (metros → graus).
// map.options.crs.project faz o caminho inverso (graus → metros), útil para conferir.
map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  const point = map.options.crs!.project(e.latlng);
  const html = `
    <strong>${Math.abs(lat).toFixed(4)}°S, ${lng.toFixed(4)}°E</strong><br>
    x = ${(point.x / 1000).toFixed(2)} km, y = ${(point.y / 1000).toFixed(2)} km
  `;
  map.openPopup(html, e.latlng);
});

// Selo "API: online/offline" no topo da página.
const apiBadge = document.getElementById('api-status')!;
checkApiHealth().then((ok) => {
  apiBadge.textContent = ok ? 'API: online' : 'API: offline (static mode)';
  apiBadge.className = `badge ${ok ? 'badge-ok' : 'badge-off'}`;
});
