# evals

`profiles.json` holds 20 representative users: every equipment preset, every goal, 1 to 7 days, 20 to 75 minutes, beginners to advanced, with and without limitations and focus muscles.

- **In CI (no API key):** `tests/test_evals.py` checks that the rule-based fallback produces a valid plan for every profile, so a user always gets something usable.
- **Against a real model:** run `run_live.py` with your own key. It reports, per profile, whether the model's plan passed validation first time, after repair, or needed the fallback.

```bash
EVAL_PROVIDER=openai EVAL_MODEL=<model name> EVAL_API_KEY=<key> uv run python -m evals.run_live
```

Run it after changing prompts, the validator or the workflow, and compare the pass rate with the previous run.
