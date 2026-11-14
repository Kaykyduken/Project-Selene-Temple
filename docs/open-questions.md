# Open questions

Things not verified yet. Remove an item once it is confirmed, and record the answer where it belongs.

- [ ] Exact Horizons syntax for a point on the lunar surface; usage limits; whether it accepts direct calls from the browser (CORS)
- [ ] Horizons quantity codes for the sub-solar and sub-Earth points
- [ ] Whether the `astronomy-engine` library gives the sub-solar point offline
- [ ] Center coordinates of the 9 Artemis III regions, from the original source. `sites.json` currently holds approximate placeholders (`verified: false`); set `verified: true` and the real source once checked
- [ ] Landmark coordinates (Apollo, Chandrayaan-3) used in the prototype were written from memory
- [ ] Moon Trek API key and CORS
- [ ] Pages that did not open in automated reading: USGS Astrogeology search and LPI Lunar Surface
- [ ] Time and format of the local judging in Sorocaba
- [ ] Official deadline time with the Local Lead
- [ ] Check the real WAC and DEM files' projection and height units with `pipeline/open_dem.py` (M1 was tested only with a synthetic raster)
