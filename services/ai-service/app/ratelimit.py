"""A small in-memory rate limit per client IP.

Good enough for one container. If the service scales to several replicas, move this to
Azure Container Apps ingress rules or a shared store.
"""

import time
from collections import defaultdict, deque
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.config import Settings, get_settings

WINDOW_SECONDS = 60
_hits: dict[str, deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> None:
    now = time.monotonic()
    hits = _hits[client_ip(request)]
    while hits and now - hits[0] > WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= settings.rate_limit_per_minute:
        raise HTTPException(
            status_code=429,
            detail={"code": "rate_limited", "message": "Too many requests. Try again in a minute."},
        )
    hits.append(now)


def reset() -> None:
    """Clear all counters. For tests."""
    _hits.clear()
