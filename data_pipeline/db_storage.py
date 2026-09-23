"""
Database Storage and Schema Management.
Provides dual-mode support:
1. PostgreSQL with PostGIS (when DATABASE_URL starts with postgresql:// or postgres://)
2. Standalone SQLite with spatial GeoJSON coordinates (default local mode)
"""
import os
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from data_pipeline.config import DATABASE_URL, NODES, DATA_DIR

DB_PATH = DATA_DIR / "urban_flow.db"

def get_connection():
    """Returns database connection based on configured DATABASE_URL."""
    if DATABASE_URL.startswith("postgres"):
        import psycopg2
        return psycopg2.connect(DATABASE_URL)
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def init_database():
    """Initializes database tables, indices, and seeds the 7 SF landmark nodes."""
    is_postgres = DATABASE_URL.startswith("postgres")

    if is_postgres:
        _init_postgres()
    else:
        _init_sqlite()

    seed_nodes()
    print(f"[Database] Schema initialized and nodes seeded ({'PostgreSQL+PostGIS' if is_postgres else 'SQLite'}).")

def _init_sqlite():
    """Creates SQLite tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        description TEXT,
        capacity_baseline INTEGER,
        transit_weight REAL,
        tourist_weight REAL,
        geojson TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hourly_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        node_id TEXT NOT NULL,
        scheduled_trips INTEGER,
        foot_traffic INTEGER,
        ridership_volume INTEGER,
        temp_c REAL,
        humidity_pct INTEGER,
        precip_mm REAL,
        wind_speed_kmh REAL,
        weather_condition TEXT,
        is_rain INTEGER,
        congestion_score REAL NOT NULL,
        risk_level TEXT NOT NULL,
        is_synthetic INTEGER DEFAULT 1,
        FOREIGN KEY (node_id) REFERENCES nodes (id)
    )
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_metrics_node_time 
    ON hourly_metrics (node_id, timestamp)
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS forecasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        forecast_timestamp TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        horizon_hour INTEGER NOT NULL,
        predicted_congestion REAL NOT NULL,
        risk_level TEXT NOT NULL,
        temp_c REAL,
        weather_condition TEXT,
        scheduled_trips INTEGER,
        top_positive_factors TEXT,
        top_negative_factors TEXT,
        shap_base_value REAL,
        FOREIGN KEY (node_id) REFERENCES nodes (id)
    )
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_forecasts_node_time 
    ON forecasts (node_id, forecast_timestamp)
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_benchmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT NOT NULL,
        mae REAL NOT NULL,
        rmse REAL NOT NULL,
        r2 REAL NOT NULL,
        trained_at TEXT NOT NULL,
        notes TEXT
    )
    """)

    conn.commit()
    conn.close()

def _init_postgres():
    """Creates PostgreSQL tables with PostGIS extensions."""
    import psycopg2
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nodes (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(64) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        description TEXT,
        capacity_baseline INTEGER,
        transit_weight DOUBLE PRECISION,
        tourist_weight DOUBLE PRECISION,
        geom GEOMETRY(Point, 4326),
        geojson JSONB
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hourly_metrics (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        node_id VARCHAR(64) REFERENCES nodes(id),
        scheduled_trips INTEGER,
        foot_traffic INTEGER,
        ridership_volume INTEGER,
        temp_c DOUBLE PRECISION,
        humidity_pct INTEGER,
        precip_mm DOUBLE PRECISION,
        wind_speed_kmh DOUBLE PRECISION,
        weather_condition VARCHAR(32),
        is_rain INTEGER,
        congestion_score DOUBLE PRECISION NOT NULL,
        risk_level VARCHAR(16) NOT NULL,
        is_synthetic BOOLEAN DEFAULT TRUE
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pg_metrics_node_time ON hourly_metrics(node_id, timestamp);")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS forecasts (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(64) REFERENCES nodes(id),
        forecast_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        horizon_hour INTEGER NOT NULL,
        predicted_congestion DOUBLE PRECISION NOT NULL,
        risk_level VARCHAR(16) NOT NULL,
        temp_c DOUBLE PRECISION,
        weather_condition VARCHAR(32),
        scheduled_trips INTEGER,
        top_positive_factors JSONB,
        top_negative_factors JSONB,
        shap_base_value DOUBLE PRECISION
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_benchmarks (
        id SERIAL PRIMARY KEY,
        model_name VARCHAR(64) NOT NULL,
        mae DOUBLE PRECISION NOT NULL,
        rmse DOUBLE PRECISION NOT NULL,
        r2 DOUBLE PRECISION NOT NULL,
        trained_at TIMESTAMP WITH TIME ZONE NOT NULL,
        notes TEXT
    );
    """)

    conn.commit()
    conn.close()

def seed_nodes():
    """Seeds the 12 Chennai landmark nodes and cleans up stale records."""
    is_postgres = DATABASE_URL.startswith("postgres")
    conn = get_connection()
    cursor = conn.cursor()

    active_ids = [n["id"] for n in NODES]
    if is_postgres:
        cursor.execute("DELETE FROM nodes WHERE id NOT IN %s", (tuple(active_ids),))
    else:
        placeholders = ', '.join(['?'] * len(active_ids))
        cursor.execute(f"DELETE FROM nodes WHERE id NOT IN ({placeholders})", active_ids)
        cursor.execute(f"DELETE FROM hourly_metrics WHERE node_id NOT IN ({placeholders})", active_ids)
        cursor.execute(f"DELETE FROM forecasts WHERE node_id NOT IN ({placeholders})", active_ids)

    for node in NODES:
        geojson_geom = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [node["lng"], node["lat"]]
            },
            "properties": {
                "id": node["id"],
                "name": node["name"],
                "category": node["category"]
            }
        }

        if is_postgres:
            cursor.execute("""
            INSERT INTO nodes (id, name, category, latitude, longitude, description, capacity_baseline, transit_weight, tourist_weight, geom, geojson)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                description = EXCLUDED.description;
            """, (
                node["id"], node["name"], node["category"], node["lat"], node["lng"],
                node["description"], node["capacity_baseline"], node["transit_weight"],
                node["tourist_weight"], node["lng"], node["lat"], json.dumps(geojson_geom)
            ))
        else:
            cursor.execute("""
            INSERT OR REPLACE INTO nodes (id, name, category, latitude, longitude, description, capacity_baseline, transit_weight, tourist_weight, geojson)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                node["id"], node["name"], node["category"], node["lat"], node["lng"],
                node["description"], node["capacity_baseline"], node["transit_weight"],
                node["tourist_weight"], json.dumps(geojson_geom)
            ))

    conn.commit()
    conn.close()

def save_hourly_metrics(df):
    """Bulk inserts hourly metrics dataframe into the database."""
    is_postgres = DATABASE_URL.startswith("postgres")
    conn = get_connection()
    cursor = conn.cursor()

    rows = []
    for _, r in df.iterrows():
        ts = r["timestamp"].isoformat() if hasattr(r["timestamp"], "isoformat") else str(r["timestamp"])
        rows.append((
            ts, r["node_id"], int(r["scheduled_trips"]), int(r["foot_traffic"]),
            int(r["ridership_volume"]), float(r["temp_c"]), int(r["humidity_pct"]),
            float(r["precip_mm"]), float(r["wind_speed_kmh"]), str(r["weather_condition"]),
            int(r["is_rain"]), float(r["congestion_score"]), str(r["risk_level"]),
            1 if r["is_synthetic"] else 0
        ))

    if is_postgres:
        from psycopg2.extras import execute_values
        query = """
        INSERT INTO hourly_metrics (
            timestamp, node_id, scheduled_trips, foot_traffic, ridership_volume,
            temp_c, humidity_pct, precip_mm, wind_speed_kmh, weather_condition,
            is_rain, congestion_score, risk_level, is_synthetic
        ) VALUES %s
        """
        execute_values(cursor, query, rows)
    else:
        cursor.execute("DELETE FROM hourly_metrics")  # Clean refresh
        cursor.executemany("""
        INSERT INTO hourly_metrics (
            timestamp, node_id, scheduled_trips, foot_traffic, ridership_volume,
            temp_c, humidity_pct, precip_mm, wind_speed_kmh, weather_condition,
            is_rain, congestion_score, risk_level, is_synthetic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)

    conn.commit()
    conn.close()
    print(f"[Database] Saved {len(rows)} hourly metrics records.")

def save_forecasts(forecast_records):
    """Inserts generated 24-48h forecast records into the database."""
    is_postgres = DATABASE_URL.startswith("postgres")
    conn = get_connection()
    cursor = conn.cursor()

    if is_postgres:
        cursor.execute("DELETE FROM forecasts")
        for rec in forecast_records:
            cursor.execute("""
            INSERT INTO forecasts (
                node_id, forecast_timestamp, generated_at, horizon_hour,
                predicted_congestion, risk_level, temp_c, weather_condition,
                scheduled_trips, top_positive_factors, top_negative_factors, shap_base_value
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                rec["node_id"], rec["forecast_timestamp"], rec["generated_at"], rec["horizon_hour"],
                rec["predicted_congestion"], rec["risk_level"], rec["temp_c"], rec["weather_condition"],
                rec["scheduled_trips"], json.dumps(rec["top_positive_factors"]),
                json.dumps(rec["top_negative_factors"]), rec.get("shap_base_value", 50.0)
            ))
    else:
        cursor.execute("DELETE FROM forecasts")
        for rec in forecast_records:
            cursor.execute("""
            INSERT INTO forecasts (
                node_id, forecast_timestamp, generated_at, horizon_hour,
                predicted_congestion, risk_level, temp_c, weather_condition,
                scheduled_trips, top_positive_factors, top_negative_factors, shap_base_value
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec["node_id"], rec["forecast_timestamp"], rec["generated_at"], rec["horizon_hour"],
                rec["predicted_congestion"], rec["risk_level"], rec["temp_c"], rec["weather_condition"],
                rec["scheduled_trips"], json.dumps(rec["top_positive_factors"]),
                json.dumps(rec["top_negative_factors"]), rec.get("shap_base_value", 50.0)
            ))

    conn.commit()
    conn.close()
    print(f"[Database] Saved {len(forecast_records)} forecast records.")

def save_benchmark(model_name: str, mae: float, rmse: float, r2: float, notes: str = ""):
    """Saves evaluation metrics for models / baselines."""
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    if DATABASE_URL.startswith("postgres"):
        cursor.execute("""
        INSERT INTO model_benchmarks (model_name, mae, rmse, r2, trained_at, notes)
        VALUES (%s, %s, %s, %s, %s, %s)
        """, (model_name, mae, rmse, r2, now_str, notes))
    else:
        cursor.execute("""
        INSERT INTO model_benchmarks (model_name, mae, rmse, r2, trained_at, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (model_name, mae, rmse, r2, now_str, notes))
    conn.commit()
    conn.close()
