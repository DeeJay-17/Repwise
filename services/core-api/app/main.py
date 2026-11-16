"""Entry point: `uvicorn app.main:app`."""

import logging
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from app.config import get_settings
from app.routers import health

REQUEST_ID_HEADER = "X-Request-ID"

logger = logging.getLogger("core-api")


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    app = FastAPI(title="Repwise core API", version="0.1.0")

    @app.middleware("http")
    async def request_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # Reuse the caller's ID so one request can be traced across services.
        rid = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = rid
        logger.info(
            "%s %s %s request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            rid,
        )
        return response

    app.include_router(health.router)
    return app


app = create_app()
