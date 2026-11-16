from app.catalogue import all_exercises, shortlist


def test_no_equipment_means_bodyweight_only() -> None:
    allowed = shortlist([], [])
    assert allowed
    assert all(e.equipment == [] for e in allowed)


def test_equipment_must_all_be_owned() -> None:
    ids = {e.id for e in shortlist(["dumbbells"], [])}
    assert "dumbbell_curl" in ids
    assert "dumbbell_bench_press" not in ids  # also needs a flat bench


def test_limitations_remove_risky_exercises() -> None:
    every = [e.id for e in all_exercises()]
    no_jump = {e.id for e in shortlist([], ["no_jumping"])}
    assert "jump_squat" not in no_jump and "push_up" in no_jump
    knees = {e.id for e in shortlist(["dumbbells"], ["knees"])}
    assert "dumbbell_lunge" not in knees and "dumbbell_romanian_deadlift" in knees
    back = {e.id for e in shortlist(["barbell", "squat_rack"], ["lower_back"])}
    assert "deadlift" not in back and "back_squat" in back
    assert len(every) == 145
