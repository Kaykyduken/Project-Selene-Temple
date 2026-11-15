// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Desenha a "grade" do mapa: círculos de latitude e linhas de longitude.
// Serve de referência visual e também para testar se a projeção está certa:
// numa estereográfica polar, as latitudes têm que virar círculos centrados no
// polo e as longitudes têm que virar retas saindo do centro.

import L from 'leaflet';

// 80°S não entra aqui: ele é desenhado em vermelho por analysisArea.ts (limite da análise).
const LATITUDES = [-60, -70, -85, -88];
const LONGITUDE_STEP_DEG = 30;

const lineStyle: L.PolylineOptions = {
  color: '#7fb3ff',
  weight: 1,
  opacity: 0.6,
  interactive: false, // não "rouba" o clique do mapa
};

export function addGraticule(map: L.Map): L.LayerGroup {
  const group = L.layerGroup();

  // Círculos de latitude: 361 pontos (um por grau de longitude) ligados por linhas.
  for (const lat of LATITUDES) {
    const points: L.LatLngExpression[] = [];
    for (let lon = -180; lon <= 180; lon += 1) points.push([lat, lon]);
    L.polyline(points, lineStyle)
      .bindTooltip(`${Math.abs(lat)}°S`, { permanent: false })
      .addTo(group);
  }

  // Linhas de longitude: do círculo de 60°S até o polo.
  for (let lon = -180; lon < 180; lon += LONGITUDE_STEP_DEG) {
    L.polyline(
      [
        [-60, lon],
        [-90, lon],
      ],
      lineStyle,
    ).addTo(group);
  }

  group.addTo(map);
  return group;
}
