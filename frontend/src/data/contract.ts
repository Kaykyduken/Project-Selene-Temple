// Lunar Landing Site Navigator
// AI-assisted: first draft written by Claude (Anthropic), reviewed by the team.
//
// Contrato de dados v0.1: o formato dos JSON que o pipeline (Python) gera e que
// o site lê. Se um campo mudar aqui, tem que mudar no pipeline também.

/** De onde vem um valor. "no_data" = não existe dado; a tela mostra "no data". */
export type ProvenanceClass = 'observed' | 'model' | 'estimate' | 'hypothesis' | 'no_data';

/** Item da lista de regiões (frontend/public/data/sites.json). */
export interface SiteSummary {
  id: string;
  name: string;
  lat_deg: number;
  lon_deg: number;
  area_km2?: number; // área da região na grade do USGS
  outline?: [number, number][]; // contorno da região: lista de [lat, lon]
}

export interface CoordinateOrigin {
  source: string;
  class: ProvenanceClass;
  verified: boolean;
}

export interface SiteCatalog {
  contract_version: string;
  note: string;
  sites: SiteSummary[];
  coordinate_origin: CoordinateOrigin;
}

/** Um número com a sua origem. value = null significa "sem dado". */
export interface Metric {
  value: number | null;
  class: ProvenanceClass;
  source: string | null;
}

/** Posição de um astro no céu do local, num instante. */
export interface BodyPosition {
  az_deg: number; // azimute: direção na bússola (0 = norte, 90 = leste)
  el_deg: number; // elevação: ângulo acima do horizonte "plano"
  visible: boolean; // true se está acima do horizonte REAL (relevo) naquele azimute
}

export interface SeriesPoint {
  t_utc: string;
  sun: BodyPosition;
  earth: BodyPosition;
}

/** Arquivo completo de um local (frontend/public/data/sites/<id>.json). */
export interface SiteData {
  contract_version: string;
  site: SiteSummary & { observer_height_m: number; coordinate_origin: CoordinateOrigin };
  period: { start_utc: string; end_utc: string; step_min: number };
  horizon: {
    azimuth_step_deg: number;
    elevation_deg: number[]; // 360 valores: altura do relevo em cada direção
    dem: { product: string | null; version: string | null; resolution_m: number | null };
    max_radius_km: number | null;
    visibility_criterion: 'disc_center' | 'any_part_of_disc';
  };
  series: SeriesPoint[];
  metrics: {
    sun_time_pct: Metric;
    earth_time_pct: Metric;
    longest_no_sun_h: Metric;
    mean_slope_deg: Metric;
  };
  sources: { id: string; name: string; url: string | null; version: string | null; license: string | null }[];
  /** true = dado inventado para teste. A interface É OBRIGADA a mostrar a faixa de aviso. */
  fictitious: boolean;
}
