# 0008. Bundle a curated catalogue from free-exercise-db

- Status: accepted
- Date: 2026-11-16

## Context

The app needs exercises with photos and instructions, mapped to equipment, and it must work offline. Equipment cards need images too. Images must be free to use.

## Decision

Build the catalogue from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense, public domain) with `apps/mobile/scripts/build_catalogue.py`. The script picks about 150 well-known exercises, gives them Repwise ids and names, maps them to Repwise muscle groups and equipment (every listed item is required), and resizes one photo per exercise to 480 px. Equipment cards reuse the photo of a representative exercise. The JSON, images and a static `require` map are committed and bundled.

## Consequences

Works offline, about 3.3 MB of images, no licence obligations. Equipment photos show the item in use rather than on its own. Adding an exercise means editing the script's table and re-running it. The AI service in Phase 3 must use the same exercise ids; it will read the same `exercises.json`.
