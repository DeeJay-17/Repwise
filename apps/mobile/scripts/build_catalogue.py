# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=11"]
# ///
"""Build the bundled equipment and exercise catalogue.

Source: free-exercise-db by yuhonas (https://github.com/yuhonas/free-exercise-db),
released under the Unlicense (public domain). We pick a curated subset, map it to
Repwise's equipment and muscle groups, and resize one photo per exercise.

Run from apps/mobile:  uv run scripts/build_catalogue.py
Outputs (all generated, do not edit by hand):
  assets/catalogue/equipment.json
  assets/catalogue/exercises.json
  assets/catalogue/images/<exercise_id>.jpg
  assets/catalogue/ATTRIBUTION.md
  src/catalogue/images.generated.ts
  ../../services/ai-service/app/catalogue/exercises.json  (slim copy for plan generation)
"""

from __future__ import annotations

import io
import json
import time
import urllib.request
from pathlib import Path

from PIL import Image

SOURCE_REPO = "https://github.com/yuhonas/free-exercise-db"
RAW = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main"
LICENSE = "Unlicense (public domain)"
IMAGE_WIDTH = 480

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "catalogue"
IMG_DIR = OUT_DIR / "images"
TS_OUT = ROOT / "src" / "catalogue" / "images.generated.ts"
AI_SERVICE_OUT = ROOT.parent.parent / "services" / "ai-service" / "app" / "catalogue" / "exercises.json"
SLIM_FIELDS = ("id", "name", "category", "level", "mechanic", "primaryMuscles", "secondaryMuscles",
               "equipment", "defaultTarget")

# ---------------------------------------------------------------------------
# Equipment: (id, name, category, exercise id whose photo represents it)
# ---------------------------------------------------------------------------
EQUIPMENT = [
    ("dumbbells", "Dumbbells", "free_weights", "dumbbell_curl"),
    ("barbell", "Barbell and plates", "free_weights", "deadlift"),
    ("ez_bar", "EZ curl bar", "free_weights", "ez_bar_curl"),
    ("kettlebell", "Kettlebell", "free_weights", "kettlebell_swing"),
    ("resistance_bands", "Resistance bands", "free_weights", "band_pull_apart"),
    ("flat_bench", "Flat bench", "benches_racks", "dumbbell_bench_press"),
    ("adjustable_bench", "Adjustable bench", "benches_racks", "incline_dumbbell_press"),
    ("squat_rack", "Squat rack", "benches_racks", "back_squat"),
    ("pull_up_bar", "Pull-up bar", "benches_racks", "pull_up"),
    ("dip_bars", "Dip bars", "benches_racks", "dip"),
    ("cable_machine", "Cable machine", "machines", "cable_crossover"),
    ("smith_machine", "Smith machine", "machines", "smith_squat"),
    ("leg_press", "Leg press", "machines", "leg_press"),
    ("hack_squat", "Hack squat machine", "machines", "hack_squat"),
    ("leg_extension", "Leg extension machine", "machines", "leg_extension"),
    ("leg_curl", "Leg curl machine", "machines", "lying_leg_curl"),
    ("chest_press_machine", "Chest press machine", "machines", "machine_chest_press"),
    ("shoulder_press_machine", "Shoulder press machine", "machines", "machine_shoulder_press"),
    ("pec_deck", "Pec deck", "machines", "pec_deck"),
    ("calf_raise_machine", "Calf raise machine", "machines", "standing_calf_raise_machine"),
    ("hip_machine", "Hip abduction/adduction machine", "machines", "hip_abduction_machine"),
    ("treadmill", "Treadmill", "cardio", "treadmill_walk"),
    ("stationary_bike", "Stationary bike", "cardio", "stationary_bike"),
    ("rowing_machine", "Rowing machine", "cardio", "rowing_machine"),
    ("elliptical", "Elliptical trainer", "cardio", "elliptical"),
    ("stair_climber", "Stair climber", "cardio", "stair_climber"),
    ("jump_rope", "Jump rope", "cardio", "jump_rope"),
]

HOME_GYM = ["dumbbells", "adjustable_bench", "flat_bench", "resistance_bands", "pull_up_bar", "kettlebell"]
PRESETS = [
    {"id": "none", "name": "No equipment", "equipmentIds": []},
    {"id": "treadmill_only", "name": "Treadmill only", "equipmentIds": ["treadmill"]},
    {"id": "home_gym", "name": "Home gym", "equipmentIds": HOME_GYM},
    {"id": "full_gym", "name": "Full gym", "equipmentIds": [e[0] for e in EQUIPMENT if e[0] != "jump_rope"]},
]

# ---------------------------------------------------------------------------
# Exercises: (repwise id, source id, required equipment (all of), options)
# options: name override, "time" for a timed default target
# ---------------------------------------------------------------------------
B = []  # bodyweight
EXERCISES: list[tuple[str, str, list[str], dict[str, str]]] = [
    # Bodyweight
    ("push_up", "Pushups", B, {"name": "Push-up"}),
    ("incline_push_up", "Incline_Push-Up", B, {"name": "Incline push-up"}),
    ("decline_push_up", "Decline_Push-Up", B, {"name": "Decline push-up"}),
    ("close_grip_push_up", "Push-Ups_-_Close_Triceps_Position", B, {"name": "Close-grip push-up"}),
    ("wide_push_up", "Push-Up_Wide", B, {"name": "Wide push-up"}),
    ("bodyweight_squat", "Bodyweight_Squat", B, {"name": "Bodyweight squat"}),
    ("jump_squat", "Freehand_Jump_Squat", B, {"name": "Jump squat"}),
    ("walking_lunge", "Bodyweight_Walking_Lunge", B, {"name": "Walking lunge"}),
    ("split_jump", "Split_Jump", B, {"name": "Split jump"}),
    ("glute_bridge", "Butt_Lift_Bridge", B, {"name": "Glute bridge"}),
    ("single_leg_glute_bridge", "Single_Leg_Glute_Bridge", B, {"name": "Single-leg glute bridge"}),
    ("glute_kickback", "Glute_Kickback", B, {"name": "Glute kickback"}),
    ("step_up_knee_raise", "Step-up_with_Knee_Raise", B, {"name": "Step-up with knee raise"}),
    ("back_extension_floor", "Hyperextensions_With_No_Hyperextension_Bench", B, {"name": "Floor back extension"}),
    ("plank", "Plank", B, {"name": "Plank", "target": "time"}),
    ("side_plank", "Side_Bridge", B, {"name": "Side plank", "target": "time"}),
    ("crunch", "Crunches", B, {"name": "Crunch"}),
    ("reverse_crunch", "Reverse_Crunch", B, {"name": "Reverse crunch"}),
    ("dead_bug", "Dead_Bug", B, {"name": "Dead bug"}),
    ("russian_twist", "Russian_Twist", B, {"name": "Russian twist"}),
    ("flutter_kicks", "Flutter_Kicks", B, {"name": "Flutter kicks"}),
    ("mountain_climber", "Mountain_Climbers", B, {"name": "Mountain climber"}),
    ("star_jump", "Star_Jump", B, {"name": "Star jump"}),
    ("bench_dip", "Bench_Dips", ["flat_bench"], {"name": "Bench dip"}),
    ("inverted_row", "Inverted_Row", ["squat_rack"], {"name": "Inverted row"}),
    ("pull_up", "Pullups", ["pull_up_bar"], {"name": "Pull-up"}),
    ("chin_up", "Chin-Up", ["pull_up_bar"], {"name": "Chin-up"}),
    ("dip", "Dips_-_Triceps_Version", ["dip_bars"], {"name": "Dip"}),
    # Dumbbells
    ("dumbbell_bench_press", "Dumbbell_Bench_Press", ["dumbbells", "flat_bench"], {"name": "Dumbbell bench press"}),
    ("incline_dumbbell_press", "Incline_Dumbbell_Press", ["dumbbells", "adjustable_bench"], {"name": "Incline dumbbell press"}),
    ("dumbbell_floor_press", "Dumbbell_Floor_Press", ["dumbbells"], {"name": "Dumbbell floor press"}),
    ("dumbbell_fly", "Dumbbell_Flyes", ["dumbbells", "flat_bench"], {"name": "Dumbbell fly"}),
    ("incline_dumbbell_fly", "Incline_Dumbbell_Flyes", ["dumbbells", "adjustable_bench"], {"name": "Incline dumbbell fly"}),
    ("one_arm_dumbbell_row", "One-Arm_Dumbbell_Row", ["dumbbells", "flat_bench"], {"name": "One-arm dumbbell row"}),
    ("bent_over_dumbbell_row", "Bent_Over_Two-Dumbbell_Row", ["dumbbells"], {"name": "Bent-over dumbbell row"}),
    ("dumbbell_pullover", "Straight-Arm_Dumbbell_Pullover", ["dumbbells", "flat_bench"], {"name": "Dumbbell pullover"}),
    ("dumbbell_shoulder_press", "Standing_Dumbbell_Press", ["dumbbells"], {"name": "Dumbbell shoulder press"}),
    ("arnold_press", "Arnold_Dumbbell_Press", ["dumbbells", "adjustable_bench"], {"name": "Arnold press"}),
    ("lateral_raise", "Side_Lateral_Raise", ["dumbbells"], {"name": "Lateral raise"}),
    ("front_raise", "Front_Dumbbell_Raise", ["dumbbells"], {"name": "Front raise"}),
    ("rear_delt_fly", "Reverse_Flyes", ["dumbbells"], {"name": "Rear delt fly"}),
    ("dumbbell_shrug", "Dumbbell_Shrug", ["dumbbells"], {"name": "Dumbbell shrug"}),
    ("dumbbell_upright_row", "Standing_Dumbbell_Upright_Row", ["dumbbells"], {"name": "Dumbbell upright row"}),
    ("dumbbell_curl", "Dumbbell_Bicep_Curl", ["dumbbells"], {"name": "Dumbbell curl"}),
    ("hammer_curl", "Hammer_Curls", ["dumbbells"], {"name": "Hammer curl"}),
    ("incline_dumbbell_curl", "Incline_Dumbbell_Curl", ["dumbbells", "adjustable_bench"], {"name": "Incline dumbbell curl"}),
    ("concentration_curl", "Concentration_Curls", ["dumbbells"], {"name": "Concentration curl"}),
    ("zottman_curl", "Zottman_Curl", ["dumbbells"], {"name": "Zottman curl"}),
    ("overhead_dumbbell_extension", "Standing_Dumbbell_Triceps_Extension", ["dumbbells"], {"name": "Overhead dumbbell extension"}),
    ("tricep_kickback", "Tricep_Dumbbell_Kickback", ["dumbbells"], {"name": "Triceps kickback"}),
    ("lying_dumbbell_extension", "Lying_Dumbbell_Tricep_Extension", ["dumbbells", "flat_bench"], {"name": "Lying dumbbell extension"}),
    ("dumbbell_squat", "Dumbbell_Squat", ["dumbbells"], {"name": "Dumbbell squat"}),
    ("dumbbell_lunge", "Dumbbell_Lunges", ["dumbbells"], {"name": "Dumbbell lunge"}),
    ("dumbbell_reverse_lunge", "Dumbbell_Rear_Lunge", ["dumbbells"], {"name": "Dumbbell reverse lunge"}),
    ("dumbbell_split_squat", "Split_Squat_with_Dumbbells", ["dumbbells"], {"name": "Dumbbell split squat"}),
    ("dumbbell_step_up", "Dumbbell_Step_Ups", ["dumbbells", "flat_bench"], {"name": "Dumbbell step-up"}),
    ("dumbbell_romanian_deadlift", "Stiff-Legged_Dumbbell_Deadlift", ["dumbbells"], {"name": "Dumbbell Romanian deadlift"}),
    ("dumbbell_calf_raise", "Standing_Dumbbell_Calf_Raise", ["dumbbells"], {"name": "Dumbbell calf raise"}),
    ("dumbbell_side_bend", "Dumbbell_Side_Bend", ["dumbbells"], {"name": "Dumbbell side bend"}),
    # Barbell
    ("back_squat", "Barbell_Squat", ["barbell", "squat_rack"], {"name": "Barbell back squat"}),
    ("front_squat", "Front_Squat_Clean_Grip", ["barbell", "squat_rack"], {"name": "Barbell front squat"}),
    ("bench_press", "Barbell_Bench_Press_-_Medium_Grip", ["barbell", "flat_bench", "squat_rack"], {"name": "Barbell bench press"}),
    ("incline_bench_press", "Barbell_Incline_Bench_Press_-_Medium_Grip", ["barbell", "adjustable_bench", "squat_rack"], {"name": "Incline barbell bench press"}),
    ("close_grip_bench_press", "Close-Grip_Barbell_Bench_Press", ["barbell", "flat_bench", "squat_rack"], {"name": "Close-grip bench press"}),
    ("floor_press", "Floor_Press", ["barbell"], {"name": "Barbell floor press"}),
    ("deadlift", "Barbell_Deadlift", ["barbell"], {"name": "Deadlift"}),
    ("romanian_deadlift", "Romanian_Deadlift", ["barbell"], {"name": "Romanian deadlift"}),
    ("sumo_deadlift", "Sumo_Deadlift", ["barbell"], {"name": "Sumo deadlift"}),
    ("bent_over_row", "Bent_Over_Barbell_Row", ["barbell"], {"name": "Barbell bent-over row"}),
    ("t_bar_row", "T-Bar_Row_with_Handle", ["barbell"], {"name": "T-bar row"}),
    ("overhead_press", "Standing_Military_Press", ["barbell", "squat_rack"], {"name": "Overhead press"}),
    ("barbell_curl", "Barbell_Curl", ["barbell"], {"name": "Barbell curl"}),
    ("barbell_hip_thrust", "Barbell_Hip_Thrust", ["barbell", "flat_bench"], {"name": "Barbell hip thrust"}),
    ("barbell_glute_bridge", "Barbell_Glute_Bridge", ["barbell"], {"name": "Barbell glute bridge"}),
    ("barbell_lunge", "Barbell_Lunge", ["barbell", "squat_rack"], {"name": "Barbell lunge"}),
    ("good_morning", "Good_Morning", ["barbell", "squat_rack"], {"name": "Good morning"}),
    ("barbell_shrug", "Barbell_Shrug", ["barbell"], {"name": "Barbell shrug"}),
    ("upright_row", "Upright_Barbell_Row", ["barbell"], {"name": "Barbell upright row"}),
    ("barbell_calf_raise", "Standing_Barbell_Calf_Raise", ["barbell", "squat_rack"], {"name": "Barbell calf raise"}),
    ("ab_rollout", "Barbell_Ab_Rollout", ["barbell"], {"name": "Barbell ab rollout"}),
    # EZ bar
    ("ez_bar_curl", "EZ-Bar_Curl", ["ez_bar"], {"name": "EZ-bar curl"}),
    ("skullcrusher", "EZ-Bar_Skullcrusher", ["ez_bar", "flat_bench"], {"name": "EZ-bar skullcrusher"}),
    # Kettlebell
    ("kettlebell_swing", "One-Arm_Kettlebell_Swings", ["kettlebell"], {"name": "Kettlebell swing"}),
    ("goblet_squat", "Goblet_Squat", ["kettlebell"], {"name": "Goblet squat"}),
    ("kettlebell_row", "One-Arm_Kettlebell_Row", ["kettlebell"], {"name": "Kettlebell row"}),
    ("kettlebell_press", "Alternating_Kettlebell_Press", ["kettlebell"], {"name": "Kettlebell press"}),
    ("kettlebell_single_leg_deadlift", "Kettlebell_One-Legged_Deadlift", ["kettlebell"], {"name": "Kettlebell single-leg deadlift"}),
    ("kettlebell_thruster", "Kettlebell_Thruster", ["kettlebell"], {"name": "Kettlebell thruster"}),
    ("kettlebell_arnold_press", "Kettlebell_Arnold_Press", ["kettlebell"], {"name": "Kettlebell Arnold press"}),
    ("kettlebell_floor_press", "One-Arm_Kettlebell_Floor_Press", ["kettlebell"], {"name": "Kettlebell floor press"}),
    ("turkish_get_up", "Kettlebell_Turkish_Get-Up_Squat_style", ["kettlebell"], {"name": "Turkish get-up"}),
    # Resistance bands
    ("band_pull_apart", "Band_Pull_Apart", ["resistance_bands"], {"name": "Band pull-apart"}),
    ("band_squat", "Squats_-_With_Bands", ["resistance_bands"], {"name": "Band squat"}),
    ("band_shoulder_press", "Shoulder_Press_-_With_Bands", ["resistance_bands"], {"name": "Band shoulder press"}),
    ("band_lateral_raise", "Lateral_Raise_-_With_Bands", ["resistance_bands"], {"name": "Band lateral raise"}),
    ("band_chest_fly", "Cross_Over_-_With_Bands", ["resistance_bands"], {"name": "Band chest fly"}),
    ("band_upright_row", "Upright_Row_-_With_Bands", ["resistance_bands"], {"name": "Band upright row"}),
    ("band_good_morning", "Band_Good_Morning", ["resistance_bands"], {"name": "Band good morning"}),
    ("band_overhead_extension", "Speed_Band_Overhead_Triceps", ["resistance_bands"], {"name": "Band overhead triceps extension"}),
    ("monster_walk", "Monster_Walk", ["resistance_bands"], {"name": "Monster walk"}),
    # Cable
    ("lat_pulldown", "Wide-Grip_Lat_Pulldown", ["cable_machine"], {"name": "Lat pulldown"}),
    ("close_grip_pulldown", "Close-Grip_Front_Lat_Pulldown", ["cable_machine"], {"name": "Close-grip pulldown"}),
    ("seated_cable_row", "Seated_Cable_Rows", ["cable_machine"], {"name": "Seated cable row"}),
    ("face_pull", "Face_Pull", ["cable_machine"], {"name": "Face pull"}),
    ("cable_crossover", "Cable_Crossover", ["cable_machine"], {"name": "Cable crossover"}),
    ("straight_arm_pulldown", "Straight-Arm_Pulldown", ["cable_machine"], {"name": "Straight-arm pulldown"}),
    ("cable_lateral_raise", "Standing_Low-Pulley_Deltoid_Raise", ["cable_machine"], {"name": "Cable lateral raise"}),
    ("triceps_pushdown", "Triceps_Pushdown", ["cable_machine"], {"name": "Triceps pushdown"}),
    ("rope_pushdown", "Triceps_Pushdown_-_Rope_Attachment", ["cable_machine"], {"name": "Rope pushdown"}),
    ("overhead_cable_extension", "Cable_Rope_Overhead_Triceps_Extension", ["cable_machine"], {"name": "Overhead cable extension"}),
    ("cable_curl", "Standing_Biceps_Cable_Curl", ["cable_machine"], {"name": "Cable curl"}),
    ("cable_hammer_curl", "Cable_Hammer_Curls_-_Rope_Attachment", ["cable_machine"], {"name": "Cable hammer curl"}),
    ("cable_crunch", "Cable_Crunch", ["cable_machine"], {"name": "Cable crunch"}),
    ("pallof_press", "Pallof_Press", ["cable_machine"], {"name": "Pallof press"}),
    ("cable_woodchop", "Standing_Cable_Wood_Chop", ["cable_machine"], {"name": "Cable woodchop"}),
    ("cable_glute_kickback", "One-Legged_Cable_Kickback", ["cable_machine"], {"name": "Cable glute kickback"}),
    ("cable_pull_through", "Pull_Through", ["cable_machine"], {"name": "Cable pull-through"}),
    # Machines
    ("leg_press", "Leg_Press", ["leg_press"], {"name": "Leg press"}),
    ("leg_press_calf_raise", "Calf_Press_On_The_Leg_Press_Machine", ["leg_press"], {"name": "Leg press calf raise"}),
    ("hack_squat", "Hack_Squat", ["hack_squat"], {"name": "Hack squat"}),
    ("leg_extension", "Leg_Extensions", ["leg_extension"], {"name": "Leg extension"}),
    ("lying_leg_curl", "Lying_Leg_Curls", ["leg_curl"], {"name": "Lying leg curl"}),
    ("seated_leg_curl", "Seated_Leg_Curl", ["leg_curl"], {"name": "Seated leg curl"}),
    ("smith_squat", "Smith_Machine_Squat", ["smith_machine"], {"name": "Smith machine squat"}),
    ("smith_bench_press", "Smith_Machine_Bench_Press", ["smith_machine", "flat_bench"], {"name": "Smith machine bench press"}),
    ("smith_incline_press", "Smith_Machine_Incline_Bench_Press", ["smith_machine", "adjustable_bench"], {"name": "Smith machine incline press"}),
    ("smith_shoulder_press", "Smith_Machine_Overhead_Shoulder_Press", ["smith_machine", "adjustable_bench"], {"name": "Smith machine shoulder press"}),
    ("machine_chest_press", "Machine_Bench_Press", ["chest_press_machine"], {"name": "Machine chest press"}),
    ("machine_shoulder_press", "Machine_Shoulder_Military_Press", ["shoulder_press_machine"], {"name": "Machine shoulder press"}),
    ("pec_deck", "Butterfly", ["pec_deck"], {"name": "Pec deck fly"}),
    ("reverse_pec_deck", "Reverse_Machine_Flyes", ["pec_deck"], {"name": "Reverse pec deck"}),
    ("standing_calf_raise_machine", "Standing_Calf_Raises", ["calf_raise_machine"], {"name": "Standing calf raise"}),
    ("seated_calf_raise", "Seated_Calf_Raise", ["calf_raise_machine"], {"name": "Seated calf raise"}),
    ("hip_abduction_machine", "Thigh_Abductor", ["hip_machine"], {"name": "Hip abduction"}),
    ("hip_adduction_machine", "Thigh_Adductor", ["hip_machine"], {"name": "Hip adduction"}),
    # Cardio
    ("treadmill_walk", "Walking_Treadmill", ["treadmill"], {"name": "Treadmill walk", "target": "time"}),
    ("treadmill_incline_walk", "Walking_Treadmill", ["treadmill"], {"name": "Treadmill incline walk", "target": "time",
        "instructions": "Set the treadmill to a 6 to 12 percent incline and a brisk walking pace.|Walk tall without holding the handrails.|Keep a pace where you can talk in short sentences."}),
    ("treadmill_jog", "Jogging_Treadmill", ["treadmill"], {"name": "Treadmill jog", "target": "time"}),
    ("treadmill_run", "Running_Treadmill", ["treadmill"], {"name": "Treadmill run", "target": "time"}),
    ("treadmill_intervals", "Running_Treadmill", ["treadmill"], {"name": "Treadmill intervals", "target": "time",
        "instructions": "Warm up with a few minutes of easy walking.|Each set is one fast interval: run hard for the set time.|During the rest, slow to an easy walk before the next interval."}),
    ("stationary_bike", "Bicycling_Stationary", ["stationary_bike"], {"name": "Stationary bike", "target": "time"}),
    ("rowing_machine", "Rowing_Stationary", ["rowing_machine"], {"name": "Rowing machine", "target": "time"}),
    ("elliptical", "Elliptical_Trainer", ["elliptical"], {"name": "Elliptical", "target": "time"}),
    ("stair_climber", "Stairmaster", ["stair_climber"], {"name": "Stair climber", "target": "time"}),
    ("jump_rope", "Rope_Jumping", ["jump_rope"], {"name": "Jump rope", "target": "time"}),
]

# Source muscle names -> Repwise muscle groups (packages/contracts/plan.schema.json)
MUSCLES = {
    "abdominals": "core", "abductors": "glutes", "adductors": "quadriceps", "biceps": "biceps",
    "calves": "calves", "chest": "chest", "forearms": "forearms", "glutes": "glutes",
    "hamstrings": "hamstrings", "lats": "back", "lower back": "back", "middle back": "back",
    "neck": None, "quadriceps": "quadriceps", "shoulders": "shoulders", "traps": "back",
    "triceps": "triceps",
}
CATEGORIES = {"strength": "strength", "powerlifting": "strength", "plyometrics": "plyometric", "cardio": "cardio"}


def fetch(url: str, attempts: int = 4) -> bytes:
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:  # noqa: S310 - fixed https host
                return r.read()
        except OSError:
            if attempt == attempts:
                raise
            time.sleep(2 * attempt)
    raise AssertionError("unreachable")


def muscles(names: list[str]) -> list[str]:
    out: list[str] = []
    for n in names:
        m = MUSCLES[n]
        if m and m not in out:
            out.append(m)
    return out


def main() -> None:
    source = {x["id"]: x for x in json.loads(fetch(f"{RAW}/dist/exercises.json"))}
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    known_equipment = {e[0] for e in EQUIPMENT}

    exercises = []
    seen = set()
    for ex_id, src_id, equipment, opts in EXERCISES:
        assert ex_id not in seen, f"duplicate id {ex_id}"
        seen.add(ex_id)
        assert set(equipment) <= known_equipment, f"{ex_id}: unknown equipment {equipment}"
        src = source[src_id]
        primary = muscles(src["primaryMuscles"])
        secondary = [m for m in muscles(src["secondaryMuscles"]) if m not in primary]
        category = CATEGORIES.get(src["category"], "strength")
        assert src["images"], f"{ex_id}: source {src_id} has no photo"
        image_path = src["images"][0]
        image_url = f"{RAW}/exercises/{image_path}"

        out_path = IMG_DIR / f"{ex_id}.jpg"
        if not out_path.exists():  # delete the images folder to force a re-download
            img = Image.open(io.BytesIO(fetch(image_url))).convert("RGB")
            if img.width > IMAGE_WIDTH:
                size = (IMAGE_WIDTH, round(img.height * IMAGE_WIDTH / img.width))
                img = img.resize(size, Image.LANCZOS)
            img.save(out_path, "JPEG", quality=72, optimize=True, progressive=True)

        instructions = opts["instructions"].split("|") if "instructions" in opts else src["instructions"]
        exercises.append({
            "id": ex_id,
            "name": opts.get("name", src["name"]),
            "category": category,
            "level": src["level"],
            "mechanic": src.get("mechanic"),
            "primaryMuscles": primary or ["full_body"],
            "secondaryMuscles": secondary,
            "equipment": equipment,
            "defaultTarget": opts.get("target", "time" if category == "cardio" else "reps"),
            "instructions": instructions,
            "image": {"file": f"{ex_id}.jpg", "sourceUrl": image_url, "license": LICENSE},
            "sourceId": src_id,
        })
        print(f"  {ex_id}")

    equipment_out = []
    for eq_id, name, category, image_ex in EQUIPMENT:
        assert image_ex in seen, f"{eq_id}: image exercise {image_ex} missing"
        equipment_out.append({"id": eq_id, "name": name, "category": category, "imageExerciseId": image_ex})

    meta = {"version": 1, "source": SOURCE_REPO, "license": LICENSE}
    (OUT_DIR / "equipment.json").write_text(
        json.dumps({**meta, "equipment": equipment_out, "presets": PRESETS}, indent=2) + "\n")
    (OUT_DIR / "exercises.json").write_text(
        json.dumps({**meta, "exercises": exercises}, indent=2, ensure_ascii=False) + "\n")

    AI_SERVICE_OUT.parent.mkdir(parents=True, exist_ok=True)
    slim = [{k: e[k] for k in SLIM_FIELDS} for e in exercises]
    AI_SERVICE_OUT.write_text(json.dumps({**meta, "exercises": slim}, indent=2) + "\n")

    lines = [
        "// Generated by scripts/build_catalogue.py. Do not edit.",
        "// Metro needs a static require() for every bundled image.",
        "",
        "export const exerciseImages: Record<string, number> = {",
        *[f"  {e['id']}: require('../../assets/catalogue/images/{e['id']}.jpg')," for e in exercises],
        "};",
        "",
    ]
    TS_OUT.parent.mkdir(parents=True, exist_ok=True)
    TS_OUT.write_text("\n".join(lines))

    (OUT_DIR / "ATTRIBUTION.md").write_text(
        "# Catalogue attribution\n\n"
        f"Exercise data and photos come from [free-exercise-db]({SOURCE_REPO}) by yuhonas, "
        "released under the [Unlicense](https://unlicense.org/) (public domain). "
        "Repwise selects a subset, renames exercises, maps muscles and equipment, and resizes the photos.\n\n"
        "Equipment cards reuse the photo of a representative exercise (`imageExerciseId` in `equipment.json`). "
        "Each exercise's original image URL is recorded in `exercises.json` under `image.sourceUrl`.\n\n"
        "Regenerate with `uv run scripts/build_catalogue.py` from `apps/mobile`.\n")
    print(f"{len(exercises)} exercises, {len(equipment_out)} equipment items")


if __name__ == "__main__":
    main()
