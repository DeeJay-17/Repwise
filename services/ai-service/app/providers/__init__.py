"""Chat-model adapters for OpenAI, Google and Anthropic, and provider error handling.

The user's API key is passed in per request, used for that call only, and never stored
or logged.
"""

from dataclasses import dataclass

from langchain_core.language_models.chat_models import BaseChatModel

from app.models import Provider


def make_chat_model(provider: Provider, model: str, api_key: str, timeout: float) -> BaseChatModel:
    """Build a LangChain chat model for one request."""
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=model, api_key=api_key, timeout=timeout, max_retries=1)
    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model, google_api_key=api_key, timeout=timeout, max_retries=1
        )
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(  # type: ignore[call-arg]
            model_name=model, api_key=api_key, timeout=timeout, max_retries=1
        )
    raise ValueError(f"Unknown provider: {provider}")


@dataclass
class ProviderError(Exception):
    """A provider call failed in a way the user must fix (key, model name, quota)."""

    code: str
    status: int
    message: str


def _status_of(exc: BaseException) -> int | None:
    for attr in ("status_code", "code", "status"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    return value if isinstance(value, int) else None


def classify_provider_error(exc: BaseException) -> ProviderError:
    """Turn a provider SDK exception into a safe, user-facing error.

    Provider messages are never passed through, because some echo part of the key.
    """
    name = type(exc).__name__.lower()
    status = _status_of(exc)
    if status in (401, 403) or "authentication" in name or "permission" in name:
        return ProviderError("provider_auth", 401, "The provider rejected the API key.")
    if status == 404 or "notfound" in name:
        return ProviderError(
            "model_not_found", 400, "The provider does not recognise that model name."
        )
    if status == 429 or "ratelimit" in name or "resourceexhausted" in name:
        return ProviderError(
            "provider_rate_limited", 429, "The provider's rate limit or quota was reached."
        )
    if "timeout" in name or isinstance(exc, TimeoutError):
        return ProviderError("provider_timeout", 504, "The provider took too long to respond.")
    if status == 400 or "badrequest" in name or "invalidargument" in name:
        return ProviderError(
            "provider_bad_request",
            400,
            "The provider refused the request. The model may not support structured output.",
        )
    return ProviderError("provider_error", 502, "The provider returned an unexpected error.")
