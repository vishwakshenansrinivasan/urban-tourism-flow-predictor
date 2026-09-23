"""
Weather Service Module.
Integrates with OpenWeatherMap API for live/forecast conditions, with a high-fidelity
meteorological simulation fallback calibrated for San Francisco's coastal microclimate.
"""
import math
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from data_pipeline.config import OPENWEATHER_API_KEY, CITY_CENTER

def fetch_live_weather(lat=CITY_CENTER["lat"], lon=CITY_CENTER["lng"]):
    """
    Attempts to fetch live current weather from OpenWeatherMap API.
    Returns dict with standardized metrics or None if API key missing or request fails.
    """
    if not OPENWEATHER_API_KEY:
        return None

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric"
    }
    try:
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            main = data.get("main", {})
            wind = data.get("wind", {})
            weather_list = data.get("weather", [{}])
            rain_dict = data.get("rain", {})

            condition = weather_list[0].get("main", "Clear")
            precip = rain_dict.get("1h", 0.0)

            return {
                "temp_c": round(main.get("temp", 15.0), 1),
                "humidity_pct": main.get("humidity", 70),
                "precip_mm": round(precip, 2),
                "wind_speed_kmh": round(wind.get("speed", 3.0) * 3.6, 1),
                "weather_condition": condition,
                "is_rain": 1 if (condition.lower() in ["rain", "drizzle", "thunderstorm"] or precip > 0) else 0,
                "is_mock": False
            }
    except Exception as e:
        print(f"[Weather] Live API fetch error: {e}. Falling back to simulation.")
    return None


def generate_weather_timeseries(start_dt: datetime, end_dt: datetime) -> pd.DataFrame:
    """
    Generates realistic hourly weather data across a datetime window for San Francisco.
    Includes diurnal cycles, seasonal base temperatures, realistic multi-hour rain events,
    and Pacific coastal wind patterns.
    """
    hours_count = int((end_dt - start_dt).total_seconds() // 3600) + 1
    timestamps = [start_dt + timedelta(hours=i) for i in range(hours_count)]

    # Deterministic seed based on start date for reproducible training & evaluation
    seed_val = int(start_dt.timestamp()) % (2**31 - 1)
    rng = np.random.RandomState(seed_val)

    records = []
    # Rain event state machine (rain happens in continuous storms, not scattered isolated hours)
    in_rain_storm = False
    storm_hours_left = 0
    storm_intensity = 0.0

    for ts in timestamps:
        hour = ts.hour
        month = ts.month

        # Seasonal base temperature in SF: winter ~11°C, summer/fall ~17°C
        seasonal_base = 11.0 + 6.0 * math.sin((month - 1) / 12.0 * 2 * math.pi - math.pi / 2)
        # Diurnal swing: coldest at 05:00 (-3°C from mean), warmest at 14:00 (+4°C from mean)
        diurnal_temp = 3.5 * math.sin((hour - 8) / 24.0 * 2 * math.pi)
        temp_c = round(seasonal_base + diurnal_temp + rng.normal(0, 0.8), 1)

        # Diurnal humidity: peaks near dawn, lowest in mid-afternoon
        diurnal_hum = 75 - 15 * math.sin((hour - 8) / 24.0 * 2 * math.pi)
        humidity_pct = int(np.clip(diurnal_hum + rng.normal(0, 4), 40, 98))

        # Wind speed: highest in late afternoon (Pacific sea breeze)
        base_wind = 12.0 + 8.0 * math.sin((hour - 10) / 24.0 * 2 * math.pi)
        wind_speed = round(max(3.0, base_wind + rng.normal(0, 2.5)), 1)

        # Precipitation simulation (SF has rainy winters Nov-Mar, dry summers Jun-Sep)
        rain_probability = 0.12 if month in [11, 12, 1, 2, 3] else 0.02

        if not in_rain_storm:
            if rng.rand() < rain_probability:
                in_rain_storm = True
                storm_hours_left = rng.randint(3, 9)
                storm_intensity = rng.uniform(1.2, 7.5)

        precip_mm = 0.0
        if in_rain_storm:
            precip_mm = round(storm_intensity * rng.uniform(0.6, 1.4), 2)
            storm_hours_left -= 1
            if storm_hours_left <= 0:
                in_rain_storm = False

        # Condition category
        if precip_mm > 0.5:
            condition = "Rain"
        elif hour in [5, 6, 7, 8, 21, 22] and humidity_pct > 82:
            condition = "Fog"
        elif humidity_pct > 75:
            condition = "Clouds"
        else:
            condition = "Clear"

        records.append({
            "timestamp": ts,
            "temp_c": temp_c,
            "humidity_pct": humidity_pct,
            "precip_mm": precip_mm,
            "wind_speed_kmh": wind_speed,
            "weather_condition": condition,
            "is_rain": 1 if precip_mm > 0.1 else 0
        })

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    now = datetime.now(timezone.utc)
    live = fetch_live_weather()
    print("Live weather check:", live if live else "No live key provided; using simulated weather.")
    
    sim_df = generate_weather_timeseries(now - timedelta(days=2), now + timedelta(days=2))
    print(f"Generated {len(sim_df)} weather hourly steps. Preview:")
    print(sim_df.head(8))
