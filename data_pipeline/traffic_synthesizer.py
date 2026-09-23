"""
Foot-Traffic and Transit Congestion Synthesizer for Chennai Metropolitan Area.
Calibrated against CMRL Metro, Southern Railway Suburban EMU, MTC Bus frequency,
cultural temple/festival cycles, coastal beach leisure patterns, and Coromandel weather.

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
    Synthesizes an hourly dataset across all 12 Chennai nodes over HISTORICAL_DAYS.
    """
    if end_dt is None:
        end_dt = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    if start_dt is None:
        start_dt = end_dt - timedelta(days=HISTORICAL_DAYS)

    # 1. Fetch GTFS scheduled trips baseline
    print("[Synthesizer] Fetching Chennai CMRL/Suburban/MTC transit baseline...")
    gtfs_schedule = extract_scheduled_transit_frequencies()

    # 2. Generate synchronized weather timeseries
    print(f"[Synthesizer] Generating Chennai tropical weather series ({start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')})...")
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

            temp_c = weather_row.get("temp_c", 30.0)
            feels_like_c = weather_row.get("feels_like_c", temp_c)
            precip_mm = weather_row.get("precip_mm", 0.0)
            is_rain = weather_row.get("is_rain", 0)
            is_fog = weather_row.get("is_fog", 0)
            wind_speed = weather_row.get("wind_speed_kmh", 14.0)
            cond = str(weather_row.get("weather_condition", "Sunny & Warm"))

            # Scheduled trips for this slot
            sched_trips = node_gtfs.get((dow, hour), 6)

            # --- Human Movement Component Modeling in Chennai ---
            # 1. Commuter Pattern: Peak morning (08:30-10:30) and evening rush (17:30-20:30) on weekdays
            if not is_weekend:
                commuter_morning = math.exp(-0.5 * ((hour - 9.0) / 1.2) ** 2)
                commuter_evening = math.exp(-0.5 * ((hour - 18.5) / 1.4) ** 2)
                commuter_midday = 0.22 if (11 <= hour <= 16) else 0.06
                commuter_curve = 0.90 * commuter_morning + 0.98 * commuter_evening + commuter_midday
            else:
                # Weekend commuter volume is low
                commuter_curve = 0.15 * math.exp(-0.5 * ((hour - 13) / 4.0) ** 2) + 0.05

            # 2. Tourist & Leisure Pattern (Marina Beach, T. Nagar shopping, Mylapore, Phoenix Mall)
            # In Chennai, extreme afternoon heat shifts outdoor tourist flow toward evenings (16:30 - 21:30)
            if "BEACH" in n_id or "BESANT" in n_id:
                # Beaches peak heavily in cool sea-breeze evenings (17:00 - 21:00)
                tourist_peak_hour = 18.0
                tourist_spread = 2.4
                tourist_weekend_boost = 2.10 if is_weekend else 1.10
            elif "T_NAGAR" in n_id or "PHOENIX" in n_id:
                # Retail shopping surges on weekend afternoons & evenings
                tourist_peak_hour = 17.0
                tourist_spread = 3.0
                tourist_weekend_boost = 1.85 if is_weekend else 1.05
            elif "MYLAPORE" in n_id or "SANTHOME" in n_id:
                # Temples & cathedrals have morning pooja peak (07:00-10:00) and evening pooja peak (17:00-20:00)
                morning_p = math.exp(-0.5 * ((hour - 8.0) / 1.5) ** 2)
                evening_p = math.exp(-0.5 * ((hour - 18.5) / 1.5) ** 2)
                tourist_curve = (0.75 * morning_p + 0.85 * evening_p) * (1.6 if is_weekend else 1.0)
                tourist_peak_hour = None
            else:
                tourist_peak_hour = 15.5
                tourist_spread = 3.2
                tourist_weekend_boost = 1.65 if is_weekend else 0.95

            if tourist_peak_hour is not None:
                tourist_curve = math.exp(-0.5 * ((hour - tourist_peak_hour) / tourist_spread) ** 2) * tourist_weekend_boost

            # 3. Weather elasticity in Chennai
            # Heavy monsoon rain heavily reduces open beach / market visits (-40% to -65%) and pushes people to Metro
            if is_rain:
                tourist_weather_mult = max(0.35, 1.0 - (precip_mm * 0.08))
                commuter_weather_mult = 1.15  # major shift from 2-wheelers/buses to CMRL Metro
            elif temp_c >= 37.0:
                # Extreme summer heat suppresses outdoor movement between 12:00 and 15:30
                if 12 <= hour <= 15:
                    tourist_weather_mult = 0.65
                else:
                    tourist_weather_mult = 1.10  # compensation in evening
                commuter_weather_mult = 0.95
            else:
                # Pleasant evening or winter temperature boosts leisure flow
                tourist_weather_mult = 1.10 if ("Sea Breeze" in cond or (17 <= hour <= 21)) else 1.0
                commuter_weather_mult = 1.0

            # Combined base foot traffic volume
            base_commuters = capacity * 0.68 * transit_w * commuter_curve * commuter_weather_mult
            base_tourists = capacity * 0.72 * tourist_w * tourist_curve * tourist_weather_mult
            late_night_floor = capacity * 0.03

            # Stochastic noise (+/- 6%) + occasional festival surge (e.g. Pongal, Margazhi music season, Diwali shopping)
            random_shock = rng.normal(1.0, 0.05)
            surge_mult = 1.50 if rng.rand() < 0.018 else 1.0

            foot_traffic = int(max(25, (base_commuters + base_tourists + late_night_floor) * random_shock * surge_mult))

            # Ridership volume (boardings/alightings)
            ridership_volume = int(min(foot_traffic * 0.85, sched_trips * 140 * rng.uniform(0.75, 1.25)))

            # --- Congestion Score (0 - 100) ---
            demand_ratio = foot_traffic / float(capacity)
            transit_capacity_ratio = ridership_volume / max(1, (sched_trips * 130))
            
            # Monsoon rain friction on roads & platform bottlenecks
            rain_friction = 9.0 if (is_rain and precip_mm > 4.0) else (4.0 if is_rain else 0.0)

            raw_score = (demand_ratio * 65.0) + (transit_capacity_ratio * 30.0) + rain_friction
            congestion_score = round(float(np.clip(raw_score, 3.0, 98.5)), 1)

            # Categorical Risk
            if congestion_score < 35.0:
                risk_level = "LOW"
            elif congestion_score < 60.0:
                risk_level = "MODERATE"
            elif congestion_score < 80.0:
                risk_level = "HIGH"
            else:
                risk_level = "CRITICAL"

            all_node_records.append({
                "node_id": n_id,
                "timestamp": ts.isoformat(),
                "congestion_score": congestion_score,
                "risk_level": risk_level,
                "foot_traffic": foot_traffic,
                "ridership_volume": ridership_volume,
                "scheduled_trips": sched_trips,
                "temp_c": temp_c,
                "feels_like_c": feels_like_c,
                "precip_mm": precip_mm,
                "humidity_pct": weather_row.get("humidity_pct", 75),
                "wind_speed_kmh": wind_speed,
                "weather_condition": cond,
                "is_rain": is_rain,
                "is_fog": is_fog,
                "is_synthetic": 1
            })

    df = pd.DataFrame(all_node_records)
    print(f"[Synthesizer] Generated {len(df)} total hourly records across {len(NODES)} Chennai nodes.")
    return df

if __name__ == "__main__":
    df = synthesize_historical_dataset()
    print("Preview of synthesized dataset for Chennai:")
    print(df[["node_id", "timestamp", "congestion_score", "risk_level", "foot_traffic", "weather_condition"]].head(10))
