# AGENTS.md

## Project Direction

This repository is the user's personal route map, derived from `ben-29/workouts_page` and pushed to `malinkang/workouts_page`.

The long-term goal is a web version of a personal "world fog" / route coverage map:

1. E-bike trips from Ninebot Notion data.
2. Workout tracks from sports apps or Notion workout records.
3. Estimated subway/transit routes from station/time data.
4. Future route sources that can be normalized into the same frontend route schema.

## Repository Remotes

- `origin` should point to the user's repository: `https://github.com/malinkang/workouts_page.git`.
- `upstream` may point to the original project for reference: `https://github.com/ben-29/workouts_page.git`.
- Do not push to `upstream`.

## Data Model

The frontend consumes `src/static/activities.json`. Each route-like item should preserve this shape:

- `run_id`: stable integer id.
- `name`: display name.
- `type`: normalized route type such as `Ride`, `Run`, `Walk`, `RoadTrip`, `Transit` if added later.
- `start_date` and `start_date_local`.
- `distance`: meters.
- `moving_time`: `H:MM:SS` string.
- `average_speed`: meters per second.
- `summary_polyline`: encoded polyline in latitude/longitude order.
- `source`: source identifier, for example `notion-ninebot`.

## Notion / Ninebot Rules

- Use `run_page/notion_sync.py` for Notion ingestion.
- The Ninebot Trips Notion database stores GPX in the `GPX` files property as `*_gcj02.gpx.json`.
- The JSON wrapper contains the original GPX XML under the `gpx` key.
- Ninebot records should be normalized as `Ride`.
- Prefer the `Stable Key` property for local start/end times because Notion date properties may be timezone-normalized.
- Do not print Notion tokens or private route URLs.

## Future Subway / Transit Route Rules

When adding subway or transit tracks:

- Prefer storing station/time records in Notion, then deriving route geometry locally.
- Keep generated route geometry deterministic and reproducible.
- Mark the source clearly, e.g. `source: "notion-transit"`.
- Use a separate type such as `Transit` only after updating frontend constants, filters, colors, and labels.
- If route geometry is estimated, make that clear in docs and avoid mixing it with GPS-accurate tracks without a source label.

## Validation

Before claiming a route sync change is complete:

```bash
python3 -m py_compile run_page/notion_sync.py
python3 run_page/notion_sync.py --full-sync
python3 -m json.tool src/static/activities.json >/dev/null
npx pnpm@8.7.0 build
```

Also verify:

- GitHub Actions `Run Data Sync` succeeds.
- Remote `src/static/activities.json` has the expected number of routes.
- No token values or private raw exports are committed.
