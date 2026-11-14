// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Desenha as regiões candidatas no mapa como círculos clicáveis e controla
// qual delas está destacada.

import L from 'leaflet';
import type { SiteSummary } from '../data/contract';

const NORMAL: L.CircleMarkerOptions = { radius: 7, color: '#ffb347', weight: 2, fillColor: '#ffb347', fillOpacity: 0.35 };
const SELECTED: L.CircleMarkerOptions = { radius: 10, color: '#ffffff', weight: 3, fillColor: '#ffb347', fillOpacity: 0.9 };

export class SiteLayer {
  private markers = new Map<string, L.CircleMarker>();

  /** onSelect é chamado quando o usuário clica num marcador. */
  constructor(map: L.Map, sites: SiteSummary[], onSelect: (site: SiteSummary) => void) {
    for (const site of sites) {
      const marker = L.circleMarker([site.lat_deg, site.lon_deg], NORMAL)
        .bindTooltip(site.name)
        .on('click', (e) => {
          // Impede que o clique "vaze" para o mapa e dispare também o clique de ponto livre.
          L.DomEvent.stopPropagation(e);
          onSelect(site);
        })
        .addTo(map);
      this.markers.set(site.id, marker);
    }
  }

  /** Destaca uma região (ou nenhuma, se id for null). */
  highlight(id: string | null): void {
    for (const [siteId, marker] of this.markers) {
      marker.setStyle(siteId === id ? SELECTED : NORMAL);
      marker.setRadius(siteId === id ? SELECTED.radius! : NORMAL.radius!);
      if (siteId === id) marker.bringToFront();
    }
  }
}
