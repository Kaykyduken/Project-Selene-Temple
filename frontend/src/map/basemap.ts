// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Carrega a imagem de fundo (mosaico LROC WAC do polo sul) que o script
// pipeline/prepare_basemap.py gera. O script grava dois arquivos:
//   - wac_south.png  → a imagem já reprojetada para a nossa projeção polar
//   - wac_south.json → onde a imagem fica no mapa (limites em metros) e a fonte
//
// Se os arquivos ainda não existirem, o mapa continua funcionando só com a grade.

import L from 'leaflet';
import 'proj4leaflet';
import { BASEMAP_JSON_URL } from '../config';

/** Formato do JSON gerado pelo pipeline. */
interface BasemapInfo {
  image: string; // nome do arquivo PNG, na mesma pasta do JSON
  bounds_m: [number, number, number, number]; // [xmin, ymin, xmax, ymax] em metros
  source: string; // texto de atribuição da fonte
  fictitious: boolean;
}

/**
 * Tenta carregar o mapa-base. Devolve uma mensagem curta para mostrar na tela.
 */
export async function loadBasemap(map: L.Map): Promise<string> {
  let info: BasemapInfo;
  try {
    const response = await fetch(BASEMAP_JSON_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    info = (await response.json()) as BasemapInfo;
  } catch {
    return 'Base map not generated yet (run pipeline/prepare_basemap.py). Showing the coordinate grid only.';
  }

  const [xmin, ymin, xmax, ymax] = info.bounds_m;
  // A URL da imagem é relativa à URL do JSON.
  const imageUrl = new URL(info.image, new URL(BASEMAP_JSON_URL, window.location.href)).href;

  // L.Proj.imageOverlay (do Proj4Leaflet) recebe os limites em METROS da projeção.
  // O L.imageOverlay normal recebe latitude/longitude e quebra em mapas polares,
  // porque os quatro cantos da imagem ficam todos na mesma latitude.
  // Os tipos do @types/proj4leaflet dizem LatLngBounds, mas o código da biblioteca
  // usa L.Bounds em metros (conferido em proj4leaflet.js); por isso o "as unknown as".
  const projectedBounds = L.bounds([xmin, ymin], [xmax, ymax]);
  L.Proj.imageOverlay(imageUrl, projectedBounds as unknown as L.LatLngBounds, {
    pane: 'basemap',
    attribution: info.source,
  }).addTo(map);

  return info.fictitious ? 'FICTITIOUS DATA: placeholder base map.' : '';
}
