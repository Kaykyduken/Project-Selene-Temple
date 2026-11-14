// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Constantes compartilhadas pelo front end.
// IMPORTANTE: a projeção aqui tem que ser IGUAL à de pipeline/common/moon.py,
// senão a imagem de fundo e os cliques ficam desalinhados.

/** Raio médio da Lua em metros (raio de referência usado pelos dados do LOLA). */
export const MOON_RADIUS_M = 1_737_400;

/**
 * Projeção estereográfica polar sul da Lua, no formato do proj4.
 * - proj=stere  → estereográfica (projeta a esfera num plano tangente ao polo)
 * - lat_0=-90   → o plano encosta no polo SUL
 * - lon_0=0     → o meridiano 0° aponta para "cima" no mapa
 * - R=1737400   → esfera com o raio da Lua (sem isso o proj4 usaria a Terra!)
 */
export const MOON_SOUTH_POLAR_STEREO =
  '+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs';

/**
 * Metade da largura do mapa, em metros, medida a partir do polo.
 * A latitude -60° fica a ~931 km do polo nessa projeção, então 1.000 km
 * cobre toda a região de 60°S até o polo, que é a área do tile WAC.
 */
export const MAP_HALF_EXTENT_M = 1_000_000;

/** Onde o pipeline grava a imagem de fundo e os metadados dela. */
export const BASEMAP_JSON_URL = `${import.meta.env.BASE_URL}data/basemap/wac_south.json`;
