# Data sources

Owner: Raphaela (track F3). Before a source goes on the site or the project page, record the downloaded version, check its license and attribution, and set its provenance label.

## Core (P0)

| Use | Source | Notes |
|---|---|---|
| Terrain, horizon, slope | [LOLA polar adjusted DEMs, NASA PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) (Barker et al. 2023) | Start with the south pole 20 m LDEM. Cite the paper |
| Quick-start terrain | [LOLA GDR polar (PDS, MIT mirror)](https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE) | LDEM_85S_20M is 60 MB as JP2 |
| Sun and Earth positions | [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) · [manual](https://ssd.jpl.nasa.gov/horizons/manual.html) | Supports user-defined sites on bodies with a rotation model. Exact lunar-surface syntax and rate limits to verify |
| Validation | [LOLA polar illumination and Earth visibility, NASA PGDA product 69](https://pgda.gsfc.nasa.gov/products/69) (Mazarico et al. 2011) | ~18.6-year averages; validates order of magnitude, not a specific date. Cite the paper |
| Regions | [USGS down-selected Artemis III candidate landing site navigational grids](https://www.usgs.gov/data/down-selected-artemis-iii-candidate-landing-site-navigational-grids) (DOI 10.5066/P1MEQ6UK) | CC0 |
| 2D base map | [LROC WAC global mosaic, south polar tile](https://data.lroc.im-ldi.com/lroc/view_rdr_product/WAC_GLOBAL_P900S0000_100M) | 100 m/pixel, 60°S–90°S. Needs conversion to tiles/COG |
| 3D globe (P1) | [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) | Optimized for looks, not science |

The 9 Artemis III candidate regions: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. Center coordinates must come from the original source (to verify).

## Python helpers

- [astroquery jplhorizons](https://astroquery.readthedocs.io/) accepts arbitrary topocentric coordinates
- [lhorizon](https://github.com/MillionConcepts/lhorizon) was written for arbitrary lunar-surface sites

## Optional

| Source | Use |
|---|---|
| [PDS Geosciences Node, Moon](https://pds-geosciences.wustl.edu/dataserv/moon.html) | Alternative download and official citation |
| [Robbins Lunar Crater Database v1](https://astrogeology.usgs.gov/search/map/moon_crater_database_v1_robbins) | Crater layer; cite Robbins (2019), doi 10.1029/2018JE005592 |
| [NSSDCA Moon page](https://nssdc.gsfc.nasa.gov/planetary/planets/moonpage.html) | Check landmark coordinates (Apollo, etc.) |

## Provenance labels

Every value shown carries one label and its source:

| Label | Examples |
|---|---|
| Observed | LOLA altimetry points |
| Model | Slope, horizon mask, average illumination, Sun/Earth positions |
| Estimate | Visibility at a specific date and observer height |
| Hypothesis | Suitability indices |

## Attribution rules

Credit NASA as the data source, never suggest endorsement, and do not use the NASA insignia or logotype.

## Horizons body codes

Confirmed against the API on 2026-11-14: Moon `301`, Sun `10`, Earth `399`.

## Wikipedia links (historic landmarks)

Each Apollo landmark links to its Wikipedia article (`en.wikipedia.org/wiki/Apollo_NN` or `pt.wikipedia.org/...`). Wikipedia is a reference link for further reading, not a data source: no text or number from it is used on the site. The addresses follow the standard article names and were not individually opened by the team yet.

## 3D Moon texture (Educational mode)

`frontend/public/data/globe/moon_globe_4k.jpg` is built by `pipeline/prepare_globe_texture.py` from the NASA SVS CGI Moon Kit global color map (2048 x 1024, LRO/LROC data), enlarged to 4096 x 2048, with the detail of the LROC WAC south polar mosaic (the site's base map) blended in below 60°S. The colour stays the NASA one; only local brightness and relief come from the WAC. The tool picks the axis orientation of the polar image by correlation with the global map (the chosen one matches the stereographic formula, correlation 0.46).

## Historic landmarks (Educational mode)

- Coordinates of the six Apollo landing sites: [NASA NSSDCA, Apollo Landing Site Coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html), values as shown on that page on 2026-11-15 (they differ by a few metres from the table compiled by the team). Stored in `frontend/public/data/landmarks.json`.
- Touchdown times (UTC): [NASA NSSDCA, Apollo Lunar Landings](https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html), as compiled by the team; not re-checked.
- Images: [NASA Image and Video Library](https://images.nasa.gov) through its public API, loaded live in the browser with the search "Apollo NN lunar surface"; each image links to its page in the library. The selection is the library's search order, not curated.
- History texts and study questions: AI-assisted draft (Claude), pending team review.
