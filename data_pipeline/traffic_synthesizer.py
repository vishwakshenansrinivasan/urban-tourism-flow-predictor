"""
Foot-Traffic and Transit Congestion Synthesizer.
Generates realistic historical and baseline crowd density and transit bottleneck dynamics
calibrated against scheduled GTFS frequency, diurnal human movement patterns,
and meteorological sensitivity for San Francisco hub nodes.

ALL generated historical foot traffic rows are explicitly labeled with `is_synthetic = True`.
"""
import math
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from data_pipeline.config import NODES, HISTORICAL_DAYS
from data_pipeline.gtfs_ingest import extract_scheduled_transit_frequencies
from data_pipeline.weather_service import generate_weather_timeseries

def synthesize_historical_dataset(start_dt: datetime = None, end_dt: datetime = None) -> pd.DataFrame:
    """
    Synthesizes an hourly dataset across all 7 San Francisco nodes.
    Features:
      - node attributes (id, capacity, transit_weight, tourist_weight)
      - scheduled GTFS transit trips for that day-of-week and hour
      - weather features (temp, humidity, rain, wind)
      - foot_traffic_count (estimated humans per hour passing through node)
      - transit_ridership_volume (passengers boarding/alighting)
      - congestion_score (0-100 normalized bottleneck index)
      - is_synthetic = True
    """
    if end_dt is None:
        end_dt = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    if start_dt is None:
        start_dt = end_dt - timedelta(days=HISTORICAL_DAYS)

    # 1. Fetch GTFS scheduled trips baseline
    print("[Synthesizer] Fetching GTFS scheduled transit baseline...")
    gtfs_schedule = extract_scheduled_transit_frequencies()

    # 2. Generate synchronized weather timeseries
    print(f"[Synthesizer] Generating coastal weather series ({start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')})...")
    weather_df = generate_weather_timeseries(start_dt, end_dt)
    weather_map = {row["timestamp"]: row for _, row in weather_df.iterrows()}

    # 3. Multi-node time series generation
    hours_count = int((end_dt - start_dt).total_seconds() // 3600) + 1
    timestamps = [start_dt + timedelta(hours=i) for i in range(hours_count)]

    all_node_records = []
    rng = np.random.RandomState(42)

    for node in NODES:
        n_id = node["id"]
        capacity = node["capacity_baseline"]
        transit_w = node["transit_weight"]
        tourist_w = node["tourist_weight"]
        cat = node["category"]

        # Filter GTFS for this node
        node_gtfs = gtfs_schedule[gtfs_schedule["node_id"] == n_id].set_index(["day_of_week", "hour"])["scheduled_trips"].to_dict()

        for ts in timestamps:
            dow = ts.weekday()  # 0 = Monday, 6 = Sunday
            is_weekend = 1 if dow in [5, 6] else 0
            hour = ts.hour
            weather_row = weather_map.get(ts, {})

            temp_c = weather_row.get("temp_c", 15.0)
            precip_mm = weather_row.get("precip_mm", 0.0)
            is_rain = weather_row.get("is_rain", 0)
            wind_speed = weather_row.get("wind_speed_kmh", 12.0)

            # Scheduled trips for this slot
            sched_trips = node_gtfs.get((dow, hour), 4)

            # --- Human Movement Component Modeling ---
            # 1. Commuter Pattern: Bimodal morning (7-9) and evening (16:30-18:30) peaks on weekdays
            if not is_weekend:
                commuter_morning = math.exp(-0.5 * ((hour - 8.2) / 1.1) ** 2)
                commuter_evening = math.exp(-0.5 * ((hour - 17.5) / 1.3) ** 2)
                commuter_midday = 0.25 if (10 <= hour <= 15) else 0.08
                commuter_curve = 0.85 * commuter_morning + 0.95 * commuter_evening + commuter_midday
            else:
                # Weekend commuter volume is low and flat
                commuter_curve = 0.12 * math.exp(-0.5 * ((hour - 14) / 4.0) ** 2) + 0.05

            # 2. Tourist & Leisure Pattern: Unimodal broad afternoon peak (11:00 - 18:00), significantly amplified on weekends
            tourist_weekend_boost = 1.75 if is_weekend else 0.95
            tourist_curve = math.exp(-0.5 * ((hour - 14.5) / 3.2) ** 2) * tourist_weekend_boost

            # 3. Weather elasticity
            # Rain severely dampens outdoor tourist spots (-35% to -55%)
            if is_rain:
                tourist_weather_mult = max(0.40, 1.0 - (precip_mm * 0.12))
                commuter_weather_mult = 1.05  # slight shift from walking/biking into transit hubs
            else:
                # pleasant temperature (16-22C) boosts foot traffic
                temp_comfort = 1.0 + 0.02 * max(0, min(10, temp_c - 14))
                tourist_weather_mult = temp_comfort
                commuter_weather_mult = 1.0

            # Combined base foot traffic volume
            base_commuters = capacity * 0.65 * transit_w * commuter_curve * commuter_weather_mult
            base_tourists = capacity * 0.70 * tourist_w * tourist_curve * tourist_weather_mult
            late_night_floor = capacity * 0.04

            # Stochastic noise (+/- 7%) + occasional surge events
            random_shock = rng.normal(1.0, 0.06)
            # 1% chance of local special event or delay surge (e.g. game day, festival, protest)
            surge_mult = 1.45 if rng.rand() < 0.015 else 1.0

            foot_traffic = int(max(20, (base_commuters + base_tourists + late_night_floor) * random_shock * surge_mult))

            # Ridership volume (boardings/alightings) linked with GTFS supply & demand
            ridership_volume = int(min(foot_traffic * 0.8, sched_trips * 120 * rng.uniform(0.7, 1.3)))

            # --- Congestion Score (0 - 100) ---
            # Defined as ratio of foot traffic to theoretical capacity + transit load ratio
            demand_ratio = foot_traffic / float(capacity)
            transit_capacity_ratio = ridership_volume / max(1, (sched_trips * 110))
            
            # Weather penalty: rain slows boarding and increases platform crowding
            rain_friction = 8.0 if (is_rain and precip_mm > 1.5) else (3.0 if is_rain else 0.0)

            raw_score = (demand_ratio * 65.0) + (transit_capacity_ratio * 30.0) + rain_friction
            congestion_score = round(float(np.clip(raw_score, 2.0, 98.5)), 1)

            # Categorical Risk
            if congestion_score < 35.0:
                risk_level = "LOW"
            elif congestion_score < 60.0:
                risk_level = "MODERATE"
            elif congestion_score < 80.0:
                risk_level = "HIGH"
            else:
                risk_level = "SEVERE"

            all_node_records.append({
                "timestamp": ts,
                "node_id": n_id,
                "node_name": node["name"],
                "node_category": cat,
                "latitude": node["lat"],
                "longitude": node["lng"],
                "scheduled_trips": sched_trips,
                "foot_traffic": foot_traffic,
                "ridership_volume": ridership_volume,
                "temp_c": temp_c,
                "humidity_pct": weather_row.get("humidity_pct", 70),
                "precip_mm": precip_mm,
                "wind_speed_kmh": wind_speed,
                "weather_condition": weather_row.get("weather_condition", "Clear"),
                "is_rain": is_rain,
                "congestion_score": congestion_score,
                "risk_level": risk_level,
                "is_synthetic": True  # Explicitly labeled as synthetic per prompt requirements
            })

    df = pd.DataFrame(all_node_records)
    df.sort_values(by=["node_id", "timestamp"], inplace=True)
    df.reset_index(drop=True, inplace=True)
    print(f"[Synthesizer] Generated {len(df)} total hourly records across {len(NODES)} nodes.")
    return df

if __name__ == "__main__":
    df = synthesize_historical_dataset()
    print("Sample generated records:")
    print(df[["timestamp", "node_id", "scheduled_trips", "foot_traffic", "temp_c", "precip_mm", "congestion_score", "risk_level", "is_synthetic"]].head(10))
    print("\nSummary statistics by node:")
    print(df.groupby("node_id")["congestion_score"].describe())
