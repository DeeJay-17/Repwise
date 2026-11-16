import pytest

from app.providers import classify_provider_error, make_chat_model


class StatusError(Exception):
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


class RateLimitError(Exception):
    pass


@pytest.mark.parametrize(
    ("exc", "code", "status"),
    [
        (StatusError(401), "provider_auth", 401),
        (StatusError(403), "provider_auth", 401),
        (StatusError(404), "model_not_found", 400),
        (StatusError(429), "provider_rate_limited", 429),
        (RateLimitError(), "provider_rate_limited", 429),
        (TimeoutError(), "provider_timeout", 504),
        (StatusError(400), "provider_bad_request", 400),
        (RuntimeError("boom"), "provider_error", 502),
    ],
)
def test_classifies_provider_errors(exc: Exception, code: str, status: int) -> None:
    err = classify_provider_error(exc)
    assert (err.code, err.status) == (code, status)


@pytest.mark.parametrize("provider", ["openai", "google", "anthropic"])
def test_builds_a_model_for_each_provider_without_network(provider: str) -> None:
    model = make_chat_model(provider, "some-model", "test-key-1234567890", timeout=5)  # type: ignore[arg-type]
    assert hasattr(model, "with_structured_output")
