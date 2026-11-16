# Build stage: resolve dependencies with uv into a virtualenv.
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY alembic.ini ./

# Runtime stage: only the virtualenv and the code, run as a non-root user.
FROM python:3.12-slim
RUN useradd --create-home --uid 10001 repwise
WORKDIR /srv
COPY --from=build /srv/.venv /srv/.venv
COPY --from=build /srv/app /srv/app
COPY --from=build /srv/alembic.ini /srv/alembic.ini
ENV PATH="/srv/.venv/bin:$PATH" PYTHONUNBUFFERED=1
USER repwise
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
# Apply database migrations, then serve. Fine for one replica; with several, run
# migrations as a separate deploy step instead.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
