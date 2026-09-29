from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from weather_data import database_summary, read_forecasts, refresh_if_stale


ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
app = FastAPI(title="Taiwan Weather GIS", docs_url=None, redoc_url=None)


def ensure_weather_data() -> bool:
    try:
        refresh_if_stale()
        return False
    except (requests.RequestException, RuntimeError, ValueError):
        summary = database_summary()
        if summary["row_count"] == 0:
            raise HTTPException(
                status_code=503,
                detail="CWA forecast data is not available. Check CWA_API_KEY and retry.",
            ) from None
        return True


@app.get("/api/health")
def health() -> dict[str, Any]:
    summary = database_summary()
    return {"status": "ok" if summary["row_count"] else "empty", **summary}


@app.get("/api/forecast")
def forecast(
    county: str | None = Query(default=None, max_length=12),
    region: str | None = Query(default=None, max_length=20),
    forecast_date: str | None = Query(default=None, alias="date", max_length=10),
) -> dict[str, Any]:
    stale = ensure_weather_data()
    summary = database_summary()
    rows = read_forecasts(county=county, region=region, forecast_date=forecast_date)
    return {
        "rows": rows,
        "updatedAt": summary["updatedAt"],
        "stale": stale,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


if PUBLIC.is_dir():
    app.mount("/", StaticFiles(directory=PUBLIC, html=True), name="public")