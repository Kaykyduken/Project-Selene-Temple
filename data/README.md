# Data folder

Large downloads go in `data/raw/`, which is **not** committed (see `.gitignore`).

Expected layout for milestone M1:

```
data/raw/
├── wac/   LROC WAC south polar mosaic (e.g. WAC_GLOBAL_P900S0000_100M.TIF)
└── dem/   LOLA south pole DEM (e.g. LDEM_85S_20M.JP2 or a PGDA 90 GeoTIFF)
```

Processed, web-ready outputs are written by `pipeline/` into `frontend/public/data/` and are committed, so the site works without the raw files.
