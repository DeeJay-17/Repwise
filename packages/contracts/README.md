# contracts

Shared definitions that every part of Repwise must agree on.

| File | What it is |
| --- | --- |
| `plan.schema.json` | JSON Schema (2020-12) for a workout plan. The AI service's output, the core API's storage and the app's local copy all validate against it. |
| `examples/` | Valid example documents. CI checks each one against its schema. |

Rules:

- Change a schema only in a pull request that also updates every consumer.
- A breaking change bumps `schemaVersion` and gets a decision record in `docs/adr`.
- Rules that need the exercise catalogue (does this `exerciseId` exist, is it possible with the user's equipment) live in the ai-service validator, not here.

Validate locally:

```bash
uvx check-jsonschema --check-metaschema packages/contracts/plan.schema.json
uvx check-jsonschema --schemafile packages/contracts/plan.schema.json packages/contracts/examples/plan.example.json
```

OpenAPI specs for each service are added here from Phase 3, generated from the FastAPI apps.
