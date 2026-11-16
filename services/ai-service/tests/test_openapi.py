from scripts.export_openapi import OUT, render


def test_committed_openapi_is_up_to_date() -> None:
    assert OUT.exists(), "run: uv run python -m scripts.export_openapi"
    assert OUT.read_text() == render(), (
        "OpenAPI changed; run: uv run python -m scripts.export_openapi"
    )
