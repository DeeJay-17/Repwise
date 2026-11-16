"""Entry point: `uvicorn app.main:app`."""

import logging
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import auth, health, me, sync

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

    @app.exception_handler(HTTPException)
    async def error_body(_: Request, exc: HTTPException) -> JSONResponse:
        # Errors use {"code", "message"} (ErrorResponse) instead of FastAPI's {"detail"}.
        if isinstance(exc.detail, dict):
            return JSONResponse(exc.detail, status_code=exc.status_code)
        return JSONResponse(
            {"code": "error", "message": str(exc.detail)}, status_code=exc.status_code
        )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(me.router)
    app.include_router(sync.router)
    return app


app = create_app()
