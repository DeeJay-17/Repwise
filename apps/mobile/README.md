# mobile

The Repwise app for Android and iPhone: React Native with Expo (SDK 58), TypeScript and Expo Router. v1 is tested on Android. Everything works offline; data lives in SQLite on the phone.

```bash
npm install
npm start            # then press "a" for an Android emulator, or scan the QR code with Expo Go
npm run check        # lint, format check, type check and tests (same as CI)
```

## What works

- Onboarding: goal, experience, days per week, session length, areas to go easy on, equipment
- Equipment picker with photos and presets (no equipment, treadmill only, home gym, full gym)
- Manual plan builder: name a plan, fill each training day from exercises that fit your equipment, set sets, reps or time, and rest
- Today: this week's strip with a coloured plate per workout, day chips with the next day marked, a preview of each exercise with last time's numbers
- Workout logging: last session's numbers as placeholders (tick an empty set to copy them), a rest timer on every tick, a heavier-weight hint once every set hits the top of the range, plates per side for barbell lifts, progress bar, editable date
- History: month calendar with a plate per workout, tap a day to see it, totals and weeks that hit your target, delete a workout
- kg or lb display (stored in kg)
- AI plan generation and regeneration with focus muscles, using your own OpenAI, Google or Anthropic key (Settings → AI plan generation). The key stays in the phone's secure storage.

## AI service address

In development the app calls the AI service on the same computer that serves the app (port 8002), so Expo Go on a phone over Wi-Fi works without setup. `EXPO_PUBLIC_AI_SERVICE_URL` overrides this; `extra.aiServiceUrl` in `app.json` is used outside development. Run the service with `docker compose` or `uv run uvicorn` (see `services/ai-service`).

## Layout

| Path                | Holds                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| `app/`              | Screens; the file path is the route (Expo Router)                       |
| `src/features/`     | Components shared by several screens (equipment picker, profile fields) |
| `src/db/`           | Drizzle schema, repositories (`repo/`), change signal (`live.ts`)       |
| `src/domain/`       | Types, formatting, and export to the shared plan contract               |
| `src/catalogue/`    | Typed access to the bundled catalogue                                   |
| `src/ui/`           | Theme and basic components                                              |
| `drizzle/`          | Generated SQL migrations                                                |
| `assets/catalogue/` | Generated equipment and exercise data and photos                        |
| `__tests__/`        | End-to-end screen tests                                                 |

## Common tasks

| Task                                          | Command                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Change the database schema                    | Edit `src/db/schema.ts`, then `npm run db:generate`                                      |
| Update API types after the AI service changes | `npm run api:generate`                                                                   |
| Add or change catalogue exercises             | Edit the table in `scripts/build_catalogue.py`, then `uv run scripts/build_catalogue.py` |

Exercise data and photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain. See `assets/catalogue/ATTRIBUTION.md`.
