# Catalogue attribution

Exercise data and photos come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, released under the [Unlicense](https://unlicense.org/) (public domain). Repwise selects a subset, renames exercises, maps muscles and equipment, and resizes the photos.

Equipment cards reuse the photo of a representative exercise (`imageExerciseId` in `equipment.json`). Each exercise's original image URL is recorded in `exercises.json` under `image.sourceUrl`.

Regenerate with `uv run scripts/build_catalogue.py` from `apps/mobile`.
