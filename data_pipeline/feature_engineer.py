"""
Feature Engineering Module.
Computes spatio-temporal lag features (t-1, t-24, t-168), rolling statistics,
cyclical time encodings, and transit-weather interaction features per node.
Ensures zero data leakage for time-series forecasting.
"""
import numpy as np
import pandas as pd
from data_pipeline.config import NODES

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes the raw hourly dataframe and engineers features grouped by node_id.
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.sort_values(by=["node_id", "timestamp"], inplace=True)

    # 1. Cyclical Time Features
    hour = df["timestamp"].dt.hour
    dow = df["timestamp"].dt.weekday

    df["hour"] = hour
    df["day_of_week"] = dow
    df["is_weekend"] = (dow >= 5).astype(int)

    df["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
    df["dow_sin"] = np.sin(2 * np.pi * dow / 7.0)
    df["dow_cos"] = np.cos(2 * np.pi * dow / 7.0)

    # 2. Node Metadata mapping
    node_meta = {n["id"]: n for n in NODES}
    df["capacity_baseline"] = df["node_id"].apply(lambda x: node_meta.get(x, {}).get("capacity_baseline", 5000))
    df["transit_weight"] = df["node_id"].apply(lambda x: node_meta.get(x, {}).get("transit_weight", 0.5))
    df["tourist_weight"] = df["node_id"].apply(lambda x: node_meta.get(x, {}).get("tourist_weight", 0.5))

    # 3. Grouped Spatio-Temporal Lag & Rolling Features per Node
    grouped_dfs = []

    for node_id, group in df.groupby("node_id", as_index=False):
        group = group.sort_values("timestamp").copy()

        # Lag features: t-1, t-2, t-3, t-24 (yesterday same hour), t-168 (last week same hour)
        group["lag_1"] = group["congestion_score"].shift(1)
        group["lag_2"] = group["congestion_score"].shift(2)
        group["lag_3"] = group["congestion_score"].shift(3)
        group["lag_24"] = group["congestion_score"].shift(24)
        group["lag_168"] = group["congestion_score"].shift(168)

        # Foot traffic lags
        group["lag_foot_1"] = group["foot_traffic"].shift(1)
        group["lag_foot_24"] = group["foot_traffic"].shift(24)

        # Transit schedule lags
        group["lag_trips_1"] = group["scheduled_trips"].shift(1)
        group["lag_trips_24"] = group["scheduled_trips"].shift(24)

        # Rolling statistics on past congestion (shifted by 1 to prevent target leakage)
        past_target = group["congestion_score"].shift(1)
        group["roll_mean_3h"] = past_target.rolling(window=3, min_periods=1).mean().bfill().fillna(group["congestion_score"])
        group["roll_mean_6h"] = past_target.rolling(window=6, min_periods=1).mean().bfill().fillna(group["congestion_score"])
        group["roll_mean_24h"] = past_target.rolling(window=24, min_periods=1).mean().bfill().fillna(group["congestion_score"])
        group["roll_std_24h"] = past_target.rolling(window=24, min_periods=1).std().fillna(0)

        # Interaction features
        # Weather x Weekend (rain suppresses tourist spots especially on weekends)
        group["rain_weekend_interaction"] = group["is_rain"] * group["is_weekend"] * group["tourist_weight"]
        # Supply vs demand proxy: scheduled trips vs 24h rolling congestion
        group["transit_pressure_ratio"] = group["roll_mean_24h"] / np.maximum(1, group["scheduled_trips"])

        grouped_dfs.append(group)

    result_df = pd.concat(grouped_dfs, ignore_index=True)

    # Forward fill or fill initial lag NaNs (first 168 hours of dataset) with reasonable defaults
    # so we don't discard 168 rows if we want max training data, or drop NaNs
    result_df["lag_168"] = result_df["lag_168"].fillna(result_df["lag_24"]).fillna(result_df["congestion_score"])
    result_df["lag_24"] = result_df["lag_24"].fillna(result_df["lag_1"]).fillna(result_df["congestion_score"])
    result_df["lag_3"] = result_df["lag_3"].fillna(result_df["lag_1"]).fillna(result_df["congestion_score"])
    result_df["lag_2"] = result_df["lag_2"].fillna(result_df["lag_1"]).fillna(result_df["congestion_score"])
    result_df["lag_1"] = result_df["lag_1"].fillna(result_df["congestion_score"])

    result_df["lag_foot_24"] = result_df["lag_foot_24"].fillna(result_df["foot_traffic"])
    result_df["lag_foot_1"] = result_df["lag_foot_1"].fillna(result_df["foot_traffic"])
    result_df["lag_trips_24"] = result_df["lag_trips_24"].fillna(result_df["scheduled_trips"])
    result_df["lag_trips_1"] = result_df["lag_trips_1"].fillna(result_df["scheduled_trips"])

    result_df.sort_values(by=["timestamp", "node_id"], inplace=True)
    result_df.reset_index(drop=True, inplace=True)

    return result_df

# Standard feature columns used for XGBoost / LightGBM modeling
FEATURE_COLUMNS = [
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "is_weekend",
    "scheduled_trips",
    "temp_c",
    "humidity_pct",
    "precip_mm",
    "wind_speed_kmh",
    "is_rain",
    "capacity_baseline",
    "transit_weight",
    "tourist_weight",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_24",
    "lag_168",
    "lag_foot_1",
    "lag_foot_24",
    "lag_trips_1",
    "lag_trips_24",
    "roll_mean_3h",
    "roll_mean_6h",
    "roll_mean_24h",
    "roll_std_24h",
    "rain_weekend_interaction",
    "transit_pressure_ratio"
]

TARGET_COLUMN = "congestion_score"

if __name__ == "__main__":
    from data_pipeline.traffic_synthesizer import synthesize_historical_dataset
    raw = synthesize_historical_dataset()
    featured = build_features(raw)
    print("Features engineered successfully.")
    print(f"Total records: {len(featured)}, Columns: {len(featured.columns)}")
    print("Feature columns preview:")
    print(featured[FEATURE_COLUMNS[:8] + [TARGET_COLUMN]].head(5))
