# Open questions

Things not verified yet. Remove an item once it is confirmed, and record the answer where it belongs.

- [ ] Exact Horizons syntax for a point on the lunar surface; usage limits; whether it accepts direct calls from the browser (CORS)
- [ ] Horizons quantity codes for the sub-solar and sub-Earth points
- [ ] Whether the `astronomy-engine` library gives the sub-solar point offline
- [x] Positions of the 9 Artemis III regions: centroid and outline of each region computed from the USGS 1 km grids by `pipeline/build_sites.py` (area centre, not a NASA-selected landing point)
- [ ] Landmark coordinates (Apollo, Chandrayaan-3) used in the prototype were written from memory
- [ ] Moon Trek API key and CORS
- [ ] Pages that did not open in automated reading: USGS Astrogeology search and LPI Lunar Surface
- [ ] Time and format of the local judging in Sorocaba
- [ ] Official deadline time with the Local Lead
- [x] LOLA DEM checked with the real `LDEM_875S_20M.JP2`: south polar stereographic, R = 1737.4 km, 20 m/pixel, 16-bit integers; height in metres = value × 0.5 (SCALING_FACTOR from the `.LBL` label, not stored in the JP2)
- [ ] Run `pipeline/prepare_basemap.py` with the real WAC polar mosaic
