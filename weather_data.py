"""Fetch real CWA township forecasts and store normalized daily rows in SQLite."""

from __future__ import annotations

import argparse
import os
import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
DATASETS = {
    "F-D0047-003": "宜蘭縣",
    "F-D0047-007": "桃園市",
    "F-D0047-011": "新竹縣",
    "F-D0047-015": "苗栗縣",
    "F-D0047-019": "彰化縣",
    "F-D0047-023": "南投縣",
    "F-D0047-027": "雲林縣",
    "F-D0047-031": "嘉義縣",
    "F-D0047-035": "屏東縣",
    "F-D0047-039": "臺東縣",
    "F-D0047-043": "花蓮縣",
    "F-D0047-047": "澎湖縣",
    "F-D0047-051": "基隆市",
    "F-D0047-055": "新竹市",
    "F-D0047-059": "嘉義市",
    "F-D0047-063": "臺北市",
    "F-D0047-067": "高雄市",
    "F-D0047-071": "新北市",
    "F-D0047-075": "臺中市",
    "F-D0047-079": "臺南市",
    "F-D0047-083": "連江縣",
    "F-D0047-087": "金門縣",
}
API_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/{}"
REQUIRED_ELEMENTS = {
    "平均溫度": ("t", "Temperature", "number"),
    "最高溫度": ("maxt", "MaxTemperature", "number"),
    "最低溫度": ("mint", "MinTemperature", "number"),
    "天氣現象": ("wx", "Weather", "text"),
    "12小時降雨機率": ("pop", "ProbabilityOfPrecipitation", "number"),
}
TAIPEI = timezone(timedelta(hours=8))


def database_path() -> Path:
    configured = os.environ.get("DATABASE_PATH")
    if configured:
        return Path(configured)
    if os.environ.get("VERCEL"):
        return Path("/tmp/weather.db")
    return ROOT / "data.db"


def _number(value: Any) -> float | None:
    if value is None or str(value).strip() in {"", "-", "X", "..."}:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_dataset(
    payload: dict[str, Any],
    dataset_id: str,
    *,
    today: date | None = None,
    fetched_at: str | None = None,
) -> list[dict[str, Any]]:
    """Convert the verified CWA Locations/Location/WeatherElement schema to daily rows."""
    if str(payload.get("success", "")).lower() != "true":
        raise ValueError(f"CWA rejected dataset {dataset_id}")

    records = payload.get("records") or {}
    groups = records.get("Locations") or []
    if not groups:
        raise ValueError(f"CWA dataset {dataset_id} returned no locations")

    today = today or datetime.now(TAIPEI).date()
    first_day = today + timedelta(days=1)
    last_day = today + timedelta(days=7)
    fetched_at = fetched_at or datetime.now(TAIPEI).isoformat(timespec="seconds")
    output: list[dict[str, Any]] = []

    for group in groups:
        county_name = group.get("LocationsName") or DATASETS[dataset_id]
        for location in group.get("Location") or []:
            region_name = location.get("LocationName")
            geocode = location.get("Geocode")
            if not region_name or not geocode:
                continue

            daily: dict[date, dict[str, list[Any]]] = {}
            for element in location.get("WeatherElement") or []:
                mapping = REQUIRED_ELEMENTS.get(element.get("ElementName"))
                if not mapping:
                    continue
                field, value_key, value_type = mapping
                for period in element.get("Time") or []:
                    start = period.get("StartTime")
                    if not start:
                        continue
                    forecast_day = datetime.fromisoformat(start).date()
                    if forecast_day < first_day or forecast_day > last_day:
                        continue
                    values = period.get("ElementValue") or []
                    raw_value = next(
                        (item.get(value_key) for item in values if value_key in item),
                        None,
                    )
                    if value_type == "number":
                        value = _number(raw_value)
                    else:
                        value = str(raw_value).strip() if raw_value is not None else None
                    if value is not None:
                        daily.setdefault(forecast_day, {}).setdefault(field, []).append(value)

            for forecast_day, values in daily.items():
                temperatures = values.get("t", [])
                maximums = values.get("maxt", [])
                minimums = values.get("mint", [])
                probabilities = values.get("pop", [])
                output.append(
                    {
                        "countyName": county_name,
                        "regionName": region_name,
                        "geocode": str(geocode),
                        "dataDate": forecast_day.isoformat(),
                        "t": mean(temperatures) if temperatures else None,
                        "mint": min(minimums) if minimums else None,
                        "maxt": max(maximums) if maximums else None,
                        "wx": next(iter(values.get("wx", [])), None),
                        "pop": max(probabilities) if probabilities else None,
                        "latitude": _number(location.get("Latitude")),
                        "longitude": _number(location.get("Longitude")),
                        "sourceDataset": dataset_id,
                        "updatedAt": fetched_at,
                    }
                )

    if not output:
        raise ValueError(f"CWA dataset {dataset_id} returned no forecast periods")
    return output


def fetch_dataset(dataset_id: str, api_key: str) -> list[dict[str, Any]]:
    response = requests.get(
        API_URL.format(dataset_id),
        params={"format": "JSON"},
        headers={"Authorization": api_key},
        timeout=(5, 30),
    )
    response.raise_for_status()
    return parse_dataset(response.json(), dataset_id)


def connect(path: Path | None = None) -> sqlite3.Connection:
    target = path or database_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(target, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(path: Path | None = None) -> None:
    with connect(path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS TemperatureForecasts (
                id INTEGER PRIMARY KEY,
                countyName TEXT NOT NULL,
                regionName TEXT NOT NULL,
                geocode TEXT NOT NULL,
                dataDate TEXT NOT NULL,
                t REAL,
                mint REAL,
                maxt REAL,
                wx TEXT,
                pop REAL,
                latitude REAL,
                longitude REAL,
                sourceDataset TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                UNIQUE (geocode, dataDate)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ForecastRefresh (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                updatedAt TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_forecasts_date ON TemperatureForecasts(dataDate)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_forecasts_county ON TemperatureForecasts(countyName, regionName)"
        )


def save_forecasts(rows: list[dict[str, Any]], path: Path | None = None) -> int:
    if not rows:
        raise ValueError("Refusing to save an empty forecast set")
    frame = pd.DataFrame.from_records(rows)
    columns = [
        "countyName",
        "regionName",
        "geocode",
        "dataDate",
        "t",
        "mint",
        "maxt",
        "wx",
        "pop",
        "latitude",
        "longitude",
        "sourceDataset",
        "updatedAt",
    ]
    placeholders = ", ".join("?" for _ in columns)
    updates = ", ".join(
        f"{column} = excluded.{column}" for column in columns if column not in {"geocode", "dataDate"}
    )
    sql = (
        f"INSERT INTO TemperatureForecasts ({', '.join(columns)}) VALUES ({placeholders}) "
        f"ON CONFLICT(geocode, dataDate) DO UPDATE SET {updates}"
    )
    values = [tuple(row[column] for column in columns) for row in frame.to_dict("records")]
    refreshed_at = datetime.now(TAIPEI).isoformat(timespec="seconds")
    with connect(path) as connection:
        connection.executemany(sql, values)
        connection.execute(
            "INSERT INTO ForecastRefresh (id, updatedAt) VALUES (1, ?) "
            "ON CONFLICT(id) DO UPDATE SET updatedAt = excluded.updatedAt",
            (refreshed_at,),
        )
    return len(values)


def refresh_forecasts(api_key: str, path: Path | None = None) -> dict[str, Any]:
    if not api_key:
        raise ValueError("CWA_API_KEY is required")
    initialize_database(path)
    all_rows: list[dict[str, Any]] = []
    received_datasets: set[str] = set()
    errors: list[str] = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_dataset, dataset_id, api_key): dataset_id
            for dataset_id in DATASETS
        }
        for future in as_completed(futures):
            dataset_id = futures[future]
            try:
                rows = future.result()
                if not rows:
                    errors.append(dataset_id)
                    continue
                all_rows.extend(rows)
                received_datasets.add(dataset_id)
            except (requests.RequestException, ValueError, KeyError) as error:
                errors.append(f"{dataset_id} ({type(error).__name__})")

    counties = {row["countyName"] for row in all_rows}
    townships = {row["geocode"] for row in all_rows}
    if errors or received_datasets != set(DATASETS) or len(counties) != 22 or len(townships) < 350:
        raise RuntimeError(
            "CWA refresh incomplete: "
            f"datasets={len(received_datasets)}/{len(DATASETS)}, "
            f"counties={len(counties)}, townships={len(townships)}, "
            f"failed={len(errors)}"
        )

    saved = save_forecasts(all_rows, path)
    return {
        "dataset_count": len(received_datasets),
        "county_count": len(counties),
        "township_count": len(townships),
        "row_count": saved,
    }


def refresh_if_stale(path: Path | None = None, max_age: timedelta = timedelta(hours=5)) -> None:
    initialize_database(path)
    with connect(path) as connection:
        result = connection.execute("SELECT updatedAt FROM ForecastRefresh WHERE id = 1").fetchone()
    if result:
        refreshed_at = datetime.fromisoformat(result["updatedAt"])
        if datetime.now(TAIPEI) - refreshed_at < max_age:
            return
    api_key = os.environ.get("CWA_API_KEY", "").strip()
    refresh_forecasts(api_key, path)


def read_forecasts(
    *,
    path: Path | None = None,
    county: str | None = None,
    region: str | None = None,
    forecast_date: str | None = None,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    parameters: list[str] = []
    for column, value in (("countyName", county), ("regionName", region), ("dataDate", forecast_date)):
        if value:
            clauses.append(f"{column} = ?")
            parameters.append(value)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with connect(path) as connection:
        rows = connection.execute(
            "SELECT countyName, regionName, geocode, dataDate, t, mint, maxt, wx, pop, "
            "latitude, longitude, sourceDataset, updatedAt "
            f"FROM TemperatureForecasts{where} ORDER BY countyName, regionName, dataDate",
            parameters,
        ).fetchall()
    return [dict(row) for row in rows]


def database_summary(path: Path | None = None) -> dict[str, Any]:
    initialize_database(path)
    with connect(path) as connection:
        stats = connection.execute(
            "SELECT COUNT(*) AS row_count, COUNT(DISTINCT countyName) AS county_count, "
            "COUNT(DISTINCT geocode) AS township_count FROM TemperatureForecasts"
        ).fetchone()
        refreshed = connection.execute(
            "SELECT updatedAt FROM ForecastRefresh WHERE id = 1"
        ).fetchone()
    return {**dict(stats), "updatedAt": refreshed["updatedAt"] if refreshed else None}


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh real CWA township forecast data")
    parser.add_argument("--refresh", action="store_true", help="Fetch all official weekly datasets")
    arguments = parser.parse_args()
    if not arguments.refresh:
        parser.error("use --refresh to fetch live CWA data")
    result = refresh_forecasts(os.environ.get("CWA_API_KEY", "").strip())
    print("GATE 2 refresh passed: " + ", ".join(f"{key}={value}" for key, value in result.items()))


if __name__ == "__main__":
    main()