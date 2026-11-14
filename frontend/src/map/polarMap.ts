// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Cria o mapa do polo sul lunar usando Leaflet + Proj4Leaflet.
// O Leaflet, por padrão, só sabe desenhar mapas da Terra em Web Mercator.
// O Proj4Leaflet permite trocar o "sistema de coordenadas" (CRS) por qualquer
// projeção do proj4. Aqui usamos a estereográfica polar sul da Lua.

import L from 'leaflet';
import 'proj4leaflet';
import { MAP_HALF_EXTENT_M, MOON_SOUTH_POLAR_STEREO } from '../config';

/**
 * Monta o CRS (sistema de coordenadas) da Lua para o Leaflet.
 *
 * "resolutions" diz quantos metros cada pixel da tela representa em cada nível
 * de zoom. Começamos em 8.192 m/pixel (Lua inteira do polo até 60°S cabendo na
 * tela) e vamos dividindo por 2 até 8 m/pixel (mais perto que o DEM de 20 m).
 */
/** Metros por pixel em cada nível de zoom (índice 0 = mais afastado). */
export const RESOLUTIONS: number[] = [];
for (let r = 8192; r >= 8; r /= 2) RESOLUTIONS.push(r);

export function createMoonCrs(): L.Proj.CRS {
  const resolutions = RESOLUTIONS;

  return new L.Proj.CRS('MOON:SOUTH_POLAR_STEREO', MOON_SOUTH_POLAR_STEREO, {
    resolutions,
    // Canto superior esquerdo da área do mapa, em metros (x, y).
    origin: [-MAP_HALF_EXTENT_M, MAP_HALF_EXTENT_M],
    bounds: L.bounds(
      [-MAP_HALF_EXTENT_M, -MAP_HALF_EXTENT_M],
      [MAP_HALF_EXTENT_M, MAP_HALF_EXTENT_M],
    ),
  });
}

/**
 * Cria o mapa dentro do elemento HTML com o id indicado.
 * Começa centrado no polo sul (-90°) com zoom 2 (2.048 m/pixel).
 */
export function createPolarMap(elementId: string): L.Map {
  const crs = createMoonCrs();

  const map = L.map(elementId, {
    crs,
    center: [-90, 0],
    zoom: 2,
    minZoom: 0,
    maxZoom: RESOLUTIONS.length - 1,
    // O Leaflet tenta "dar a volta ao mundo" horizontalmente; numa projeção
    // polar isso não faz sentido, então desligamos.
    worldCopyJump: false,
    attributionControl: true,
  });

  // Painel próprio para a imagem de fundo, abaixo das linhas e marcadores.
  // (zIndex 200 é o mesmo nível que o Leaflet usa para camadas de tiles.)
  map.createPane('basemap');
  map.getPane('basemap')!.style.zIndex = '200';

  return map;
}
