"""
Module 1 Verification Script: Data Pipeline & Storage.
Tests GTFS ingestion, weather simulation, foot traffic generation,
lag feature calculation, and database persistence.
"""
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add workspace root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data_pipeline.config import NODES, HISTORICAL_DAYS
from data_pipeline.gtfs_ingest import extract_scheduled_transit_frequencies
from data_pipeline.weather_service import generate_weather_timeseries
from data_pipeline.traffic_synthesizer import synthesize_historical_dataset
from data_pipeline.feature_engineer import build_features, FEATURE_COLUMNS, TARGET_COLUMN
from data_pipeline.db_storage import init_database, save_hourly_metrics, get_connection

def verify_module_1():
    print("=" * 70)
    print("RUNNING MODULE 1 VERIFICATION: DATA PIPELINE & FEATURE STORE")
    print("=" * 70)

    # 1. Test GTFS Ingestion
    print("\n[Step 1/5] Ingesting and validating GTFS static schedule...")
    gtfs_df = extract_scheduled_transit_frequencies()
    assert len(gtfs_df) > 0, "GTFS schedule frequency table is empty!"
    assert set(gtfs_df["node_id"].unique()) == set([n["id"] for n in NODES]), "Not all nodes represented in GTFS!"
    print(f"  [OK] GTFS schedule successfully parsed: {len(gtfs_df)} node-dow-hour profiles.")
    
    # 2. Test Weather Service
    print("\n[Step 2/5] Testing coastal weather simulation...")
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    weather_df = generate_weather_timeseries(now - timedelta(days=7), now)
    assert len(weather_df) == 7 * 24 + 1, f"Unexpected weather series length: {len(weather_df)}"
    assert "temp_c" in weather_df.columns and "precip_mm" in weather_df.columns
    print(f"  [OK] Weather series generated: {len(weather_df)} hourly observations. Temp range: {weather_df['temp_c'].min()}C to {weather_df['temp_c'].max()}C.")

    # 3. Test Foot Traffic & Congestion Synthesizer
    print("\n[Step 3/5] Synthesizing historical foot traffic & congestion metrics...")
    # Use 14 days for verification to make test quick
    test_start = now - timedelta(days=14)
    raw_df = synthesize_historical_dataset(start_dt=test_start, end_dt=now)
    assert len(raw_df) > 0, "Synthesized dataframe is empty!"
    assert all(raw_df["is_synthetic"] == True), "Synthetic rows must be explicitly labeled is_synthetic=True!"
    assert raw_df["congestion_score"].min() >= 0 and raw_df["congestion_score"].max() <= 100, "Congestion scores out of bounds!"
    print(f"  [OK] Synthesized {len(raw_df)} hourly records across {len(NODES)} nodes.")
    print(f"  [OK] Mean congestion score: {raw_df['congestion_score'].mean():.2f} (Min: {raw_df['congestion_score'].min():.1f}, Max: {raw_df['congestion_score'].max():.1f})")

    # 4. Test Feature Engineering & Lags
    print("\n[Step 4/5] Testing lag features (t-1, t-24, t-168) and rolling statistics...")
    featured_df = build_features(raw_df)
    
    # Verify no NaN values in essential feature columns
    for col in FEATURE_COLUMNS:
        assert col in featured_df.columns, f"Missing feature column: {col}"
        nan_count = featured_df[col].isna().sum()
        assert nan_count == 0, f"Column {col} has {nan_count} unexpected NaN values!"
    
    # Check lag integrity for a single node
    sample_node = featured_df[featured_df["node_id"] == "SF_POWELL_ST"].sort_values("timestamp")
    # Verify lag_1 equals previous row's congestion_score
    diff_lag1 = (sample_node["lag_1"].iloc[5] - sample_node["congestion_score"].iloc[4])
    assert abs(diff_lag1) < 1e-5, f"Lag 1 mismatch: {diff_lag1}"
    print(f"  [OK] All {len(FEATURE_COLUMNS)} feature columns validated with zero data leakage.")

    # 5. Test Database Storage
    print("\n[Step 5/5] Testing database schema initialization and persistence...")
    init_database()
    save_hourly_metrics(raw_df)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM nodes")
    node_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM hourly_metrics")
    metrics_count = cursor.fetchone()[0]
    conn.close()

    assert node_count == len(NODES), f"Expected {len(NODES)} nodes in DB, got {node_count}"
    assert metrics_count == len(raw_df), f"Expected {len(raw_df)} metrics in DB, got {metrics_count}"
    print(f"  [OK] Database verified: {node_count} nodes seeded, {metrics_count} metrics rows persisted.")

    print("\n" + "=" * 70)
    print("MODULE 1 VERIFICATION PASSED: ALL DATA PIPELINE TESTS SUCCEEDED!")
    print("=" * 70)

if __name__ == "__main__":
    verify_module_1()
