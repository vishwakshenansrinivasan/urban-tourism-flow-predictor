"""
Forecast Generator Module.
Generates 24-48 hour forward rolling forecasts for all 7 hub nodes.
Integrates future GTFS schedules, forecast coastal weather, autoregressive feature rolling,
and TreeSHAP feature attributions for every hour.
Saves all forecast points to the database.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import numpy as np
import pandas as pd

# Add workspace root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data_pipeline.config import NODES, FORECAST_HORIZON_HOURS
from data_pipeline.gtfs_ingest import extract_scheduled_transit_frequencies
from data_pipeline.weather_service import generate_weather_timeseries
from data_pipeline.feature_engineer import FEATURE_COLUMNS
from data_pipeline.db_storage import get_connection, save_forecasts
from ml_service.explainability import get_explainer, explain_features

def generate_forecasts(horizon_hours: int = FORECAST_HORIZON_HOURS) -> list:
    """
    Generates rolling forecast points for all 7 nodes over horizon_hours.
    Computes SHAP explanations and saves to database.
    """
    explainer, model = get_explainer()

    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    forecast_end = now + timedelta(hours=horizon_hours)

    print(f"[Forecast] Generating {horizon_hours}-hour forward predictions ({now.strftime('%Y-%m-%d %H:00')} to {forecast_end.strftime('%Y-%m-%d %H:00')})...")

    # 1. Load GTFS schedule
    gtfs_schedule = extract_scheduled_transit_frequencies()

    # 2. Generate future weather
    weather_df = generate_weather_timeseries(now, forecast_end)
    weather_map = {row["timestamp"]: row for _, row in weather_df.iterrows()}

    # 3. Fetch recent historical metrics from database for lag seeding
    conn = get_connection()
    recent_metrics_df = pd.read_sql_query(
        "SELECT * FROM hourly_metrics ORDER BY timestamp DESC LIMIT 2000",
        conn
    )
    conn.close()

    recent_metrics_df["timestamp"] = pd.to_datetime(recent_metrics_df["timestamp"])

    all_forecast_records = []
    generated_at_str = now.isoformat()

    for node in NODES:
        n_id = node["id"]
        capacity = node["capacity_baseline"]
        transit_w = node["transit_weight"]
        tourist_w = node["tourist_weight"]

        # Filter GTFS schedule for this node
        node_gtfs = gtfs_schedule[gtfs_schedule["node_id"] == n_id].set_index(["day_of_week", "hour"])["scheduled_trips"].to_dict()

        # Get historical series for this node to seed lags
        node_history = recent_metrics_df[recent_metrics_df["node_id"] == n_id].sort_values("timestamp")

        # Rolling history buffer
        recent_congestion_scores = list(node_history["congestion_score"].values[-168:]) if len(node_history) > 0 else [50.0] * 168
        recent_foot_traffic = list(node_history["foot_traffic"].values[-24:]) if len(node_history) > 0 else [2500] * 24
        recent_trips = list(node_history["scheduled_trips"].values[-24:]) if len(node_history) > 0 else [10] * 24

        for step in range(1, horizon_hours + 1):
            target_ts = now + timedelta(hours=step)
            hour = target_ts.hour
            dow = target_ts.weekday()
            is_weekend = 1 if dow in [5, 6] else 0

            # GTFS scheduled trips for future step
            sched_trips = node_gtfs.get((dow, hour), 8)

            # Weather forecast for step
            w_row = weather_map.get(target_ts, {})
            temp_c = float(w_row.get("temp_c", 30.5))
            humidity_pct = int(w_row.get("humidity_pct", 75))
            precip_mm = float(w_row.get("precip_mm", 0.0))
            wind_speed = float(w_row.get("wind_speed_kmh", 14.0))
            is_rain = int(w_row.get("is_rain", 0))
            condition = str(w_row.get("weather_condition", "Sunny & Warm"))

            # Lags from rolling buffer
            lag_1 = recent_congestion_scores[-1]
            lag_2 = recent_congestion_scores[-2] if len(recent_congestion_scores) >= 2 else lag_1
            lag_3 = recent_congestion_scores[-3] if len(recent_congestion_scores) >= 3 else lag_2
            lag_24 = recent_congestion_scores[-24] if len(recent_congestion_scores) >= 24 else lag_1
            lag_168 = recent_congestion_scores[-168] if len(recent_congestion_scores) >= 168 else lag_24

            lag_foot_1 = recent_foot_traffic[-1]
            lag_foot_24 = recent_foot_traffic[-24] if len(recent_foot_traffic) >= 24 else lag_foot_1

            lag_trips_1 = recent_trips[-1]
            lag_trips_24 = recent_trips[-24] if len(recent_trips) >= 24 else lag_trips_1

            # Rolling averages from buffer
            roll_mean_3h = float(np.mean(recent_congestion_scores[-3:]))
            roll_mean_6h = float(np.mean(recent_congestion_scores[-6:]))
            roll_mean_24h = float(np.mean(recent_congestion_scores[-24:]))
            roll_std_24h = float(np.std(recent_congestion_scores[-24:]))

            feels_like_c = float(w_row.get("feels_like_c", temp_c - (wind_speed * 0.08)))
            is_fog = int(w_row.get("is_fog", 1 if "Fog" in condition else 0))

            # Feature dictionary for XGBoost & SHAP
            feat_dict = {
                "hour_sin": np.sin(2 * np.pi * hour / 24.0),
                "hour_cos": np.cos(2 * np.pi * hour / 24.0),
                "dow_sin": np.sin(2 * np.pi * dow / 7.0),
                "dow_cos": np.cos(2 * np.pi * dow / 7.0),
                "is_weekend": is_weekend,
                "scheduled_trips": sched_trips,
                "temp_c": temp_c,
                "feels_like_c": feels_like_c,
                "humidity_pct": humidity_pct,
                "precip_mm": precip_mm,
                "wind_speed_kmh": wind_speed,
                "is_rain": is_rain,
                "is_fog": is_fog,
                "capacity_baseline": capacity,
                "transit_weight": transit_w,
                "tourist_weight": tourist_w,
                "lag_1": lag_1,
                "lag_2": lag_2,
                "lag_3": lag_3,
                "lag_24": lag_24,
                "lag_168": lag_168,
                "lag_foot_1": lag_foot_1,
                "lag_foot_24": lag_foot_24,
                "lag_trips_1": lag_trips_1,
                "lag_trips_24": lag_trips_24,
                "roll_mean_3h": roll_mean_3h,
                "roll_mean_6h": roll_mean_6h,
                "roll_mean_24h": roll_mean_24h,
                "roll_std_24h": roll_std_24h,
                "rain_weekend_interaction": is_rain * is_weekend * tourist_w,
                "transit_pressure_ratio": roll_mean_24h / max(1, sched_trips),
                "weather_tourism_suppression": (is_rain * tourist_w * 1.8) + (is_fog * tourist_w * 0.5),
                "weather_transit_surge": is_rain * transit_w * 1.6
            }

            # Generate SHAP explanation & prediction
            explanation = explain_features(feat_dict)
            pred_congestion = explanation["predicted_score"]

            # Update rolling buffer for next autoregressive step
            recent_congestion_scores.append(pred_congestion)
            # Rough estimate of foot traffic for lag buffer
            est_foot = int(capacity * (pred_congestion / 100.0))
            recent_foot_traffic.append(est_foot)
            recent_trips.append(sched_trips)

            # Categorical Risk
            if pred_congestion < 35.0:
                risk_level = "LOW"
            elif pred_congestion < 60.0:
                risk_level = "MODERATE"
            elif pred_congestion < 80.0:
                risk_level = "HIGH"
            else:
                risk_level = "SEVERE"

            all_forecast_records.append({
                "node_id": n_id,
                "forecast_timestamp": target_ts.isoformat(),
                "generated_at": generated_at_str,
                "horizon_hour": step,
                "predicted_congestion": round(pred_congestion, 1),
                "risk_level": risk_level,
                "temp_c": round(temp_c, 1),
                "weather_condition": condition,
                "scheduled_trips": sched_trips,
                "top_positive_factors": explanation["top_positive_factors"],
                "top_negative_factors": explanation["top_negative_factors"],
                "shap_base_value": explanation["base_value"]
            })

    # Save to database
    save_forecasts(all_forecast_records)
    print(f"[Forecast] Saved {len(all_forecast_records)} forecast points with SHAP explanations across {len(NODES)} nodes.")
    return all_forecast_records

if __name__ == "__main__":
    generate_forecasts(48)
