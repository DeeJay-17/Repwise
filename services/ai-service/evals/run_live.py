"""Run every eval profile through a real model and report how each plan was produced.

EVAL_PROVIDER=openai EVAL_MODEL=<model> EVAL_API_KEY=<key> uv run python -m evals.run_live
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import cast

from langchain_core.messages import BaseMessage

from app.graph.draft import PlanDraft
from app.graph.workflow import generate_plan, model_planner
from app.models import GenerateRequest, Provider
from app.providers import make_chat_model

PROFILES = Path(__file__).parent / "profiles.json"


def main() -> int:
    provider = cast(Provider, os.environ["EVAL_PROVIDER"])
    model = os.environ["EVAL_MODEL"]
    key = os.environ["EVAL_API_KEY"]
    base = model_planner(make_chat_model(provider, model, key, timeout=120))
    profiles = json.loads(PROFILES.read_text())["profiles"]

    first_try = repaired = fallback = 0
    for item in profiles:
        calls = 0

        def counting(messages: list[BaseMessage]) -> PlanDraft:
            nonlocal calls
            calls += 1
            return base(messages)

        request = GenerateRequest(
            provider=provider,
            model=model,
            profile=item["profile"],
            focusMuscles=item["focusMuscles"],
        )
        started = time.monotonic()
        plan, _ = generate_plan(request, counting)
        seconds = time.monotonic() - started
        if plan.source == "fallback":
            outcome, fallback = "FALLBACK", fallback + 1
        elif calls == 1:
            outcome, first_try = "ok", first_try + 1
        else:
            outcome, repaired = f"ok after {calls - 1} repair(s)", repaired + 1
        print(f"{item['name']:<42} {outcome:<20} {seconds:5.1f}s")

    total = len(profiles)
    print(
        f"\nfirst try {first_try}/{total}, repaired {repaired}/{total}, fallback {fallback}/{total}"
    )
    return 1 if fallback else 0


if __name__ == "__main__":
    sys.exit(main())
