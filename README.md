# BinSight

BinSight watches waste bins in Amchit. A bin reports how full it is, how strong the smell is, and whether it is leaning. The municipality dashboard shows those readings in plain language.

## Folders

- `frontend` — the dashboard. Open it at http://localhost:4200
- `backend` — the API that stores readings and serves the dashboard. It runs at http://localhost:3000
- `database` — the MySQL setup script

## Run it

1. Install Node.js and MySQL.
2. In MySQL, run `database/binsight_db.sql` once to create `binsightdb`. That script deletes existing tables, so do not run it again on a database you want to keep.
3. In `backend`, copy `.env.example` to `.env`. Set the database password and the ThingSpeak read key. Do not commit `.env`.
4. In `backend`, run `npm install`, then `npm start`.
5. In `frontend`, run `npm install`, then `npm start`.
6. Open http://localhost:4200.

On Windows you can use `npm.cmd` instead of `npm`.

## How a reading is judged

- Under 70% full is below capacity. 70% or more is full.
- If the bin leans too far, it is marked tipped over.
- The hardware posts readings to ThingSpeak. The backend reads that channel about every 20 seconds and saves them for the bin at Amchit Municipality Center.

More detail is in `backend/README.md` and `frontend/README.md`.
