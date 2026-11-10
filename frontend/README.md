# BinSight Frontend

Angular municipality dashboard for the BinSight backend. All monitoring data
comes from the API; the frontend does not connect to MySQL or contain its own
mock dataset.

## Run locally

1. Start MySQL and configure `../backend/.env` with the `binsightdb` account.
2. From `../backend`, run `npm.cmd run build` and `npm.cmd start`.
3. From this folder, run `npm.cmd install` and `npm.cmd start`.
4. Open `http://localhost:4200/`.

The Angular dev server proxies `/api` to `http://localhost:3000` using
`proxy.conf.json`. Change the proxy target if the backend `PORT` differs.
No MySQL credentials belong in this folder.

## Views

`/dashboard`, `/bins`, `/bins/:id`, `/map`, `/cameras`,
`/detection-events`, and `/settings` are routed standalone components.
The dashboard, bins, cameras, and events refresh every 30 seconds by default.
The interval can be changed to 15 or 60 seconds in Settings and is stored in
the browser. API failures show a connection message.
Readings older than 24 hours are labeled stale by default and excluded from
current fill-status counts; the backend's `DATA_STALE_AFTER_MINUTES` controls
that threshold. Bin history remains available for inspection.

The map uses coordinates returned by the backend and OpenStreetMap tiles.
An internet connection is required for the tiles; if they fail, the map labels
the street background unavailable while markers still use backend coordinates.
An offline street map is not bundled. Camera online status remains unknown because the database lacks
that field. Event snapshot filenames are not treated as public URLs; the UI
shows `Snapshot unavailable` until the backend serves verified images.

## Verify

- `npm.cmd run build`: production Angular build.
