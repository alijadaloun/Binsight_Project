# BinSight Backend

Node.js, TypeScript, Express, and MySQL API for the supplied `binsightdb` schema.

## Setup

1. Ensure a working MySQL server is running and `binsightdb` is available.
2. Create `.env` from `.env.example` and enter your database connection settings.
   An explicitly empty `DB_PASSWORD` is accepted for local accounts that use no password.
   Set `INGEST_API_KEY` to a random value of at least 32 characters before using
   either POST route from an SMS receiver or AI service. Do not put it in Angular.
3. Run `npm.cmd install` on Windows (or `npm install` on other platforms).
4. Run `npm.cmd run build`.
5. Run `npm.cmd run check:backend` to verify the database and read endpoints.
   Run `npm.cmd run check:ingestion` to test writes (it removes its own test rows).
   Run `npm.cmd run demo:reading` to leave one 96% fill reading for the first bin
   in MySQL, then refresh the dashboard. This demo row is not removed.
6. Run `npm.cmd run dev` for development, or `npm.cmd start` after building.

The default URL is `http://localhost:3000`. Startup verifies the database connection
before accepting HTTP requests. The server binds to `127.0.0.1` by default;
set `HOST` only behind an authenticated HTTPS reverse proxy. `.env` is ignored by Git.

## Read Endpoints

- `GET /api/health`: returns `{ "status": "ok" }`.
- `GET /api/bins`: returns all bins with cluster locations, the latest sensor
  readings, stored status, and computed fill status. Properties use camelCase.
  `readingStale` is true when a reading is older than 24 hours by default or
  more than 5 minutes in the future. Stale readings keep their measurements
  and fill status. `readingStale` marks the sample as old.
  Configure the threshold with `DATA_STALE_AFTER_MINUTES`.
  Missing readings return null values. Timestamps are serialized as ISO strings
  using the database driver's local timezone interpretation of MySQL DATETIME.
- `GET /api/bins/:id`: returns one bin with the same fields; unknown IDs return 404.
- `GET /api/bins/:id/readings`: returns its readings oldest first; unknown bins return 404.
- `GET /api/sensor-readings`: returns newest readings first. Optional `bin_id`,
  `from`, and `to` query parameters filter the result. Dates use ISO format;
  invalid filters return 400.
- `GET /api/cameras`: returns cameras with cluster locations and the most recent
  event timestamp. `status` is null because the schema has no online status.
- `GET /api/detection-events`: returns events newest first with camera and
  cluster information. `snapshot` is a filename, not a public image URL.
- `GET /api/detection-events/:id`: returns one event; invalid IDs return 400
  and unknown IDs return 404.
- `GET /api/dashboard/summary`: returns computed bin status counts, total event
  count, total camera count, and the newest reading/event timestamp.
  `activeAiEvents` and `onlineCameras` are null because the schema does not
  record active event or camera online state. `totalAiEvents` counts all events.
  `staleBins` counts bins with outdated readings.

Fill status thresholds: below 70 is NORMAL (below capacity), below 85 is
WARNING, below 95 is NEEDS_COLLECTION, and 95 or above is CRITICAL. The dashboard
treats 70 or above as full. A tilt of 45 degrees or more is stored as FALLEN.
`FULL_FILL_PERCENTAGE` and `FALLEN_TILT_DEGREES` change those cutoffs.

`check:backend` uses the actual configured database, checks that all five tables
are queryable, compares the read endpoints with database counts and latest sensor
readings, and closes its temporary HTTP server and database connections afterward.

## Write Endpoints

All POST routes require `Authorization: Bearer <INGEST_API_KEY>` and accept JSON.
The sensor and camera routes use the report's snake_case field names; the SMS
gateway route accepts `sender` and `text`. If the key is unset, writes return 503.
Invalid credentials return 401. The routes return
the created record with HTTP 201. Unknown bin/camera IDs return 404; malformed
values return 400. Timestamps accept `YYYY-MM-DD HH:mm:ss` in the server's local
timezone or a timezone-qualified ISO datetime such as `2026-05-03T10:30:00Z`.

- `POST /api/sensor-readings`: `bin_id`, `timestamp`, `fill_level_percentage`
  (0-100), `gas_level` (0-9999.99), and `tilt_angle` (-999.99 to 999.99)
  are all required. Complete readings prevent a partial update from hiding
  a previously known fill level or gas measurement.
- `POST /api/detection-events`: `camera_id`, `event_type`, and `timestamp` are
  required. Event types are `GARBAGE_OUTSIDE_BIN`, `GARBAGE_TRUCK_PASS`, and
  `GARBAGE_TRUCK_STOP`. `confidence` (0-1) and `snapshot` (a filename, not an
  image URL) are optional. The response includes a `Location` header.

The sensor route ingests already-decoded sensor data. YOLO inference and image
upload/storage are separate integrations.
The ingestion key protects machine-to-machine writes only. The read-only
dashboard has no user authentication yet; add that and HTTPS before deployment.

## ThingSpeak sensor feed

The hardware team posts fill, gas, and tilt to a ThingSpeak channel. The backend
polls that channel and stores complete samples on `THINGSPEAK_BIN_ID` (default
`BIN_001`). Set `THINGSPEAK_CHANNEL_ID`, `THINGSPEAK_READ_API_KEY`, and optionally
`THINGSPEAK_POLL_SECONDS` (at least 15). Field 1 is fill percentage, field 2 is
gas, and field 3 is tilt. Empty channel updates are ignored. Each new sample
updates `bins.status` to `FALLEN` when tilt reaches the fallen threshold, otherwise
`FULL` at or above the fill threshold, otherwise `NORMAL`.

The channel write key stays with the hardware team. Do not put it in `.env` or Angular.

## Android SMS Gateway (One Cluster)

An Android forwarding app receives SMS on your existing phone and sends an HTTP
POST to `POST /api/sms/ingest`. The backend does not poll a phone number or
mobile network. Pick an app that can send a custom JSON body and an
`Authorization` header; its exact setup depends on the app.

1. In MySQL Workbench, select `binsightdb` and run `sql/sms-ingest-receipts.sql`
   once. It creates the receipt table used to prevent duplicate inserts.
2. Set `SMS_SENDER_NUMBER` in `.env` to the exact sender number shown by the
   forwarding app (including the country code), and `SMS_CLUSTER_ID` to its
   existing `cluster_id` in MySQL. `INGEST_API_KEY` must also be set to at
   least 32 random characters. Restart the backend after changing `.env`.
3. Configure the Android app to forward only messages from the cluster SIM:
   `POST https://<your-secure-backend-host>/api/sms/ingest`,
   `Content-Type: application/json`, and
   `Authorization: Bearer <INGEST_API_KEY>`. The JSON body must have two fields:

   ```json
   {"sender":"+961XXXXXXXX","text":"BIN_001,96,7.25,0,2026-09-30T12:00:00Z"}
   ```

   The SMS itself contains one line per bin:
   `bin_id,fill_level_percentage,gas_level,tilt_angle,timestamp`. Use a
   timezone-qualified ISO timestamp. Multiple bins can use newline-separated
   lines, but check SMS segment size and cost on the chosen network.
4. A successful first delivery returns HTTP 201 with `readingsCreated`; a
   retry of identical sender/text returns HTTP 200 with `duplicate: true`.
   Invalid sender, bin, or readings are rejected without inserting anything.
   Run `npm.cmd run test:sms` to check the SMS parser without MySQL.

The server defaults to `127.0.0.1`, which a phone cannot reach. Use an
authenticated HTTPS reverse proxy or secure tunnel for the Android app. Do
not expose MySQL or send the ingestion key inside an SMS. A sender number is
an allowlist check, not proof that the SMS is genuine; protect the forwarded
HTTP request with the key and HTTPS. This initial integration supports one
registered cluster SIM; additional clusters need a sender-to-cluster registry.

The schema source is `../database/binsight_db.sql`. Its initialization script
drops existing tables: do not rerun it against an existing populated database
without first reviewing and backing up that data.
