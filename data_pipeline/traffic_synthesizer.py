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
        end_dt = datetime.now().replace(minute=0, second=0, microsecond=0)
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

            # --- Diurnal Human Movement & Congestion Dynamics in Chennai ---
            # 1. Commuter Pattern:
            # - Weekday Morning Rush (08:00 - 11:00): Peak office, IT corridor, school, and railway arrival traffic.
            # - Weekday Evening Rush (17:00 - 21:00): Return office commuters + arterial choke points.
            # - Midday (11:30 - 16:00): Moderate commercial activity.
            # - Late Night (22:30 - 05:00): Steady gradual reduction to free-flow quiet roads.
            if not is_weekend:
                commuter_morning = math.exp(-0.5 * ((hour - 9.0) / 1.4) ** 2)
                commuter_evening = math.exp(-0.5 * ((hour - 18.5) / 1.6) ** 2)
                
                # Gradual night decay curve
                if hour >= 22:
                    commuter_base = 0.08 * math.exp(-0.5 * ((hour - 22.0) / 1.2) ** 2)
                elif hour <= 5:
                    commuter_base = 0.03 + (0.05 * (hour / 5.0))
                elif 6 <= hour <= 7:
                    commuter_base = 0.35 + (0.30 * (hour - 6))
                elif 11 <= hour <= 16:
                    commuter_base = 0.45
                else:
                    commuter_base = 0.30

                commuter_curve = (1.50 * commuter_morning) + (1.55 * commuter_evening) + commuter_base
            else:
                # Weekend pattern: morning leisure starts later (09:30-12:00), heavy evening shopping & dining (16:30-22:00)
                weekend_morning = math.exp(-0.5 * ((hour - 11.0) / 2.2) ** 2)
                weekend_evening = math.exp(-0.5 * ((hour - 19.0) / 2.5) ** 2)
                if hour >= 23 or hour <= 5:
                    w_base = 0.04
                else:
                    w_base = 0.25
                commuter_curve = (0.70 * weekend_morning) + (1.40 * weekend_evening) + w_base

            # 2. Tourist & Leisure Pattern (Marina Beach, T. Nagar shopping, Mylapore, Phoenix Mall)
            # In Chennai, coastal sea breeze and cooler temperatures make evenings (17:00 - 21:30) the dominant leisure window
            if "BEACH" in n_id or "BESANT" in n_id:
                # Beaches peak heavily during cool evening hours (17:00 - 21:30), quiet in morning heat
                tourist_peak_hour = 18.5
                tourist_spread = 2.2
                tourist_weekend_boost = 2.40 if is_weekend else 1.35
                # Early morning walkers at beach (06:00 - 08:00)
                beach_morning_walkers = 0.45 * math.exp(-0.5 * ((hour - 6.5) / 1.0) ** 2)
            elif "T_NAGAR" in n_id or "PHOENIX" in n_id:
                # Retail shopping surges heavily in late afternoon and evenings (16:00 - 21:30)
                tourist_peak_hour = 18.0
                tourist_spread = 2.8
                tourist_weekend_boost = 2.20 if is_weekend else 1.25
                beach_morning_walkers = 0.0
            elif "MYLAPORE" in n_id or "SANTHOME" in n_id:
                # Temples & shrines: Morning pooja peak (07:00-10:00) and evening pooja/mass peak (17:30-20:30)
                morning_p = math.exp(-0.5 * ((hour - 8.5) / 1.3) ** 2)
                evening_p = math.exp(-0.5 * ((hour - 18.5) / 1.4) ** 2)
                tourist_curve = (1.10 * morning_p + 1.30 * evening_p + (0.10 if (10 <= hour <= 16) else 0.02)) * (1.65 if is_weekend else 1.10)
                tourist_peak_hour = None
                beach_morning_walkers = 0.0
            else:
                tourist_peak_hour = 16.5
                tourist_spread = 3.0
                tourist_weekend_boost = 1.60 if is_weekend else 1.0
                beach_morning_walkers = 0.0

            if tourist_peak_hour is not None:
                # Night drop off for tourist spots
                if hour >= 23 or hour <= 5:
                    tourist_curve = 0.03
                else:
                    tourist_curve = (math.exp(-0.5 * ((hour - tourist_peak_hour) / tourist_spread) ** 2) * tourist_weekend_boost) + beach_morning_walkers

            # 3. Weather elasticity in Chennai
            # Heavy monsoon rain creates road waterlogging friction and pushes commuters to Metro rail
            if is_rain:
                tourist_weather_mult = max(0.30, 1.0 - (precip_mm * 0.09))
                commuter_weather_mult = 1.22  # Shift to public transit & severe road delay
            elif temp_c >= 37.0:
                # Extreme tropical midday heat suppresses open outdoor movement between 12:00 and 15:30
                if 12 <= hour <= 15:
                    tourist_weather_mult = 0.60
                else:
                    tourist_weather_mult = 1.15  # Shift to cooler evening
                commuter_weather_mult = 0.95
            else:
                tourist_weather_mult = 1.12 if ("Sea Breeze" in cond or (17 <= hour <= 21)) else 1.0
                commuter_weather_mult = 1.0

            # Combined base foot traffic volume
            base_commuters = capacity * 0.75 * transit_w * commuter_curve * commuter_weather_mult
            base_tourists = capacity * 0.80 * tourist_w * tourist_curve * tourist_weather_mult
            
            # Late night floor is very low (quiet roads 01:00-05:00)
            if hour >= 23 or hour <= 4:
                late_night_floor = capacity * 0.02
            else:
                late_night_floor = capacity * 0.05

            # Stochastic noise (+/- 5%) + occasional festival/event surge
            random_shock = rng.normal(1.0, 0.04)
            surge_mult = 1.45 if rng.rand() < 0.015 else 1.0

            foot_traffic = int(max(20, (base_commuters + base_tourists + late_night_floor) * random_shock * surge_mult))

            # Ridership volume (boardings/alightings)
            ridership_volume = int(min(foot_traffic * 0.90, sched_trips * 160 * rng.uniform(0.80, 1.20)))

            # --- Calibrated Congestion Score (0 - 100) ---
            demand_ratio = foot_traffic / float(capacity)
            transit_capacity_ratio = ridership_volume / max(1, (sched_trips * 125))
            
            # Monsoon rain friction on roads & platform bottlenecks
            rain_friction = 10.0 if (is_rain and precip_mm > 4.0) else (5.0 if is_rain else 0.0)

            # Smooth realistic scaling:
            # - Peak morning (08:30-10:30): demand_ratio ≈ 1.1-1.3 -> score 75-92 (HIGH/CRITICAL)
            # - Peak evening (17:30-20:30): demand_ratio ≈ 1.2-1.4 -> score 78-95 (HIGH/CRITICAL)
            # - Midday (12:00-15:30): demand_ratio ≈ 0.5-0.7 -> score 38-55 (MODERATE)
            # - Late night (23:00-04:30): demand_ratio ≈ 0.05-0.15 -> score 12-24 (LOW)
            raw_score = (demand_ratio * 58.0) + (transit_capacity_ratio * 22.0) + rain_friction
            congestion_score = round(float(np.clip(raw_score, 8.0, 98.5)), 1)

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
