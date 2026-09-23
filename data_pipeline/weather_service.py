"""
Weather Service Module.
Integrates with OpenWeatherMap API for live/forecast conditions, with a high-fidelity
meteorological simulation fallback calibrated for Chennai's tropical coastal climate.
"""
import math
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from data_pipeline.config import OPENWEATHER_API_KEY, CITY_CENTER

def fetch_live_weather(lat=CITY_CENTER["lat"], lon=CITY_CENTER["lng"]):
    """
    Attempts to fetch live current weather from OpenWeatherMap API for Chennai.
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
                "temp_c": round(main.get("temp", 30.0), 1),
                "humidity_pct": main.get("humidity", 75),
                "precip_mm": round(precip, 2),
                "wind_speed_kmh": round(wind.get("speed", 3.5) * 3.6, 1),
                "weather_condition": condition,
                "is_rain": 1 if (condition.lower() in ["rain", "drizzle", "thunderstorm"] or precip > 0) else 0,
                "is_mock": False
            }
    except Exception as e:
        print(f"[Weather] Live API fetch error: {e}. Falling back to Chennai tropical simulation.")
    return None


def generate_weather_timeseries(start_dt: datetime, end_dt: datetime) -> pd.DataFrame:
    """
    Generates realistic hourly weather data across a datetime window for Chennai (Coromandel Coast).
    Includes:
      - Tropical temperature cycle (Summer peak ~38°C in May/June, Winter ~26°C in Jan)
      - Diurnal thermal cycle + late afternoon Bay of Bengal sea breeze cooling
      - Northeast Monsoon (Oct-Dec) heavy coastal precipitation & convective thunderstorms
      - High coastal humidity dynamics (65% to 92%)
    """
    hours_count = int((end_dt - start_dt).total_seconds() // 3600) + 1
    timestamps = [start_dt + timedelta(hours=i) for i in range(hours_count)]

    # Deterministic seed based on start date for reproducible training & evaluation
    seed_val = int(start_dt.timestamp()) % (2**31 - 1)
    rng = np.random.RandomState(seed_val)

    records = []
    # Rain event state machine (convective showers & monsoon spells)
    in_rain_storm = False
    storm_hours_left = 0
    storm_intensity = 0.0

    for ts in timestamps:
        hour = ts.hour
        month = ts.month

        # Seasonal base temperature in Chennai:
        # Dec/Jan ~26°C, May/June peak ~36°C, Monsoon ~30°C
        if month in [5, 6]:
            seasonal_base = 35.5
        elif month in [4, 7, 8]:
            seasonal_base = 33.0
        elif month in [10, 11, 12]:
            seasonal_base = 28.5
        elif month in [1, 2]:
            seasonal_base = 26.0
        else:
            seasonal_base = 30.5

        # Diurnal swing: coldest at 05:00 (-4°C from mean), peak heat at 13:00 (+5°C from mean)
        diurnal_temp = 4.5 * math.sin((hour - 8) / 24.0 * 2 * math.pi)
        temp_c = round(seasonal_base + diurnal_temp + rng.normal(0, 0.9), 1)

        # Diurnal humidity: peaks near dawn (85-92%), drops in afternoon (60-70%)
        diurnal_hum = 78 - 14 * math.sin((hour - 8) / 24.0 * 2 * math.pi)
        humidity_pct = int(np.clip(diurnal_hum + rng.normal(0, 4), 48, 96))

        # Bay of Bengal Sea Breeze: sets in around 13:30-17:00, bringing cooling winds (15-25 km/h)
        base_wind = 14.0 + 9.0 * math.sin((hour - 11) / 24.0 * 2 * math.pi)
        wind_speed = round(max(4.0, base_wind + rng.normal(0, 2.5)), 1)

        # Northeast Monsoon (Oct-Dec) is Chennai's primary rainy season; SW Monsoon has evening thunderstorms (July-Sept)
        if month in [10, 11, 12]:
            rain_probability = 0.22  # High monsoon downpour probability
        elif month in [7, 8, 9]:
            rain_probability = 0.10  # Convective evening thunderstorms
        else:
            rain_probability = 0.03  # Dry sunny season

        if not in_rain_storm:
            # Evening thunderstorms often occur between 15:00 and 20:00
            hourly_boost = 1.6 if (15 <= hour <= 21) else 0.8
            if rng.rand() < (rain_probability * hourly_boost):
                in_rain_storm = True
                storm_hours_left = rng.randint(2, 7)
                storm_intensity = rng.uniform(2.5, 12.0)

        precip_mm = 0.0
        if in_rain_storm:
            precip_mm = round(storm_intensity * rng.uniform(0.7, 1.5), 2)
            storm_hours_left -= 1
            if storm_hours_left <= 0:
                in_rain_storm = False

        # Condition category calibrated for Chennai
        if precip_mm >= 6.0:
            condition = "Monsoon Downpour"
        elif precip_mm > 0.5:
            condition = "Thunderstorm / Rain"
        elif hour in [14, 15, 16, 17] and wind_speed > 18:
            condition = "Coastal Sea Breeze"
        elif temp_c >= 35.0:
            condition = "Hot Summer Spell"
        elif humidity_pct > 80 and (month in [10, 11, 12] or hour < 7):
            condition = "Humid / Overcast"
        else:
            condition = "Sunny & Warm"

        # Apparent feels-like temperature (tropical heat index with humidity)
        feels_like_c = round(temp_c + ((humidity_pct - 65) * 0.08) - (wind_speed * 0.05), 1)

        records.append({
            "timestamp": ts,
            "temp_c": temp_c,
            "feels_like_c": feels_like_c,
            "humidity_pct": humidity_pct,
            "precip_mm": precip_mm,
            "wind_speed_kmh": wind_speed,
            "weather_condition": condition,
            "is_rain": 1 if precip_mm > 0.2 else 0,
            "is_fog": 1 if (humidity_pct > 90 and hour in [5, 6]) else 0
        })

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    now = datetime.now(timezone.utc)
    sim_df = generate_weather_timeseries(now - timedelta(days=2), now + timedelta(days=2))
    print(f"[Chennai Weather] Generated {len(sim_df)} hourly steps. Preview:")
    print(sim_df[["timestamp", "temp_c", "feels_like_c", "humidity_pct", "weather_condition", "is_rain"]].head(8))
