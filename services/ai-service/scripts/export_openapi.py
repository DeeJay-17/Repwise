"""Write the service's OpenAPI document to packages/contracts/openapi/ai-service.json.

    uv run python -m scripts.export_openapi

tests/test_openapi.py fails when the committed file is out of date.
"""

import json
from pathlib import Path
from typing import Any

from app.main import app

OUT = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "openapi" / "ai-service.json"


def render() -> str:
    spec: dict[str, Any] = app.openapi()
    return json.dumps(spec, indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render())
    print(f"wrote {OUT}")
