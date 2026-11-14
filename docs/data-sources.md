# Data sources

Owner: Raphaela. Each source still needs its license and exact download link confirmed before it goes on the project page.

| Use | Source | Status |
|---|---|---|
| Terrain / horizon | LOLA polar DEMs (NASA PGDA product 90 or PDS). Start with the south pole 20 m LDEM | To download |
| Sun and Earth positions | JPL Horizons (https://ssd.jpl.nasa.gov/horizons/). The only JPL API the project needs | Query syntax to verify |
| Validation | NASA PGDA product 69 (average illumination and Earth visibility) + Horizons web interface | To download |
| Regions | USGS grids of the 9 Artemis III candidate regions | To download |
| 2D base map | LROC WAC 100 m mosaic | To download |
| 3D globe | NASA CGI Moon Kit | To download |
| Alternative download | PDS Geosciences Node | Optional |
| Optional layer | Robbins lunar crater database | Optional |
| Landmark coordinates | NSSDCA (to check Apollo and Chandrayaan-3 coordinates) | To verify |

NASA PGDA: https://pgda.gsfc.nasa.gov/

## Horizons body codes (to confirm)

Written from memory, not verified yet: Moon `301`, Sun `10`, Earth `399`.

## api.nasa.gov key

The team has one. No milestone depends on it right now. It stays in `.env`, back end only.
