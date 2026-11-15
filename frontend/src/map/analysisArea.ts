// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Borda vermelha que marca até onde a ferramenta de pontos livres consegue calcular.
// Dentro do círculo (de 80°S ao polo) existe modelo de relevo; fora dele não há dado
// para calcular o horizonte, e o clique mostra "no data".

import L from 'leaflet';
import { ANALYSIS_LIMIT_LAT_DEG } from '../config';

export const ANALYSIS_BORDER_COLOR = '#ff4d4d';

export function addAnalysisArea(map: L.Map): L.Polyline {
  const points: L.LatLngExpression[] = [];
  for (let lon = -180; lon <= 180; lon += 1) points.push([ANALYSIS_LIMIT_LAT_DEG, lon]);
  return L.polyline(points, {
    color: ANALYSIS_BORDER_COLOR,
    weight: 3,
    opacity: 0.95,
    interactive: false, // o clique passa para o mapa (dentro e fora do círculo)
  }).addTo(map);
}
