"""
Configuration for Urban Tourism and Transit Flow Predictor (San Francisco Hubs)
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
RAW_GTFS_DIR = DATA_DIR / "gtfs"
RAW_GTFS_DIR.mkdir(parents=True, exist_ok=True)

# Database Configuration
# Defaults to local SQLite file; can be overridden by DATABASE_URL (PostgreSQL + PostGIS)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'urban_flow.db'}")

# OpenWeatherMap API Key (optional - falls back to realistic SF meteorological simulation)
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")

# City Metadata
CITY_NAME = "San Francisco"
CITY_CENTER = {"lat": 37.7749, "lng": -122.4194}

# Selected 7 Landmark & Transit Hub Nodes in San Francisco
NODES = [
    {
        "id": "SF_POWELL_ST",
        "name": "Powell St Station & Cable Car Turnaround",
        "category": "transit_hub",
        "lat": 37.7844,
        "lng": -122.4080,
        "description": "Major BART/Muni subway station connecting downtown retail with the historic Powell/Hyde and Powell/Mason Cable Car turnaround.",
        "capacity_baseline": 8500,  # passengers/hour theoretical throughput
        "transit_weight": 0.85,
        "tourist_weight": 0.65,
        "gtfs_stop_ids": ["15730", "15731", "16998"]
    },
    {
        "id": "SF_FISHERMANS_WHARF",
        "name": "Fisherman's Wharf & Pier 39",
        "category": "tourist_attraction",
        "lat": 37.8080,
        "lng": -122.4177,
        "description": "San Francisco's premier waterfront tourist corridor served by F-Market & Wharves historic streetcars and tour ferries.",
        "capacity_baseline": 6000,
        "transit_weight": 0.35,
        "tourist_weight": 0.95,
        "gtfs_stop_ids": ["15664", "15665", "15666"]
    },
    {
        "id": "SF_EMBARCADERO",
        "name": "Ferry Building & Embarcadero Station",
        "category": "hybrid_hub",
        "lat": 37.7955,
        "lng": -122.3937,
        "description": "Historic ferry terminal, artisanal food hall, and critical transbay commuter hub connecting BART, Muni, and Golden Gate Ferries.",
        "capacity_baseline": 9000,
        "transit_weight": 0.80,
        "tourist_weight": 0.70,
        "gtfs_stop_ids": ["15727", "15728", "16997"]
    },
    {
        "id": "SF_UNION_SQUARE",
        "name": "Union Square Plaza",
        "category": "commercial_hub",
        "lat": 37.7879,
        "lng": -122.4075,
        "description": "Central public plaza surrounded by high-density retail, luxury hotels, theaters, and the Central Subway underground station.",
        "capacity_baseline": 7000,
        "transit_weight": 0.60,
        "tourist_weight": 0.80,
        "gtfs_stop_ids": ["17871", "17872"]
    },
    {
        "id": "SF_MISSION_DOLORES",
        "name": "Mission Dolores Park & 16th St",
        "category": "leisure_hotspot",
        "lat": 37.7596,
        "lng": -122.4269,
        "description": "High-density recreational hillside park in the Mission District with massive weekend social gatherings and heavy 16th St BART foot traffic.",
        "capacity_baseline": 5500,
        "transit_weight": 0.40,
        "tourist_weight": 0.75,
        "gtfs_stop_ids": ["15735", "15736"]
    },
    {
        "id": "SF_GOLDEN_GATE_PARK",
        "name": "Golden Gate Park Concourse (de Young & Cal Academy)",
        "category": "cultural_attraction",
        "lat": 37.7715,
        "lng": -122.4687,
        "description": "Cultural epicenter inside GGP hosting California Academy of Sciences, de Young Museum, and Japanese Tea Garden served by Muni 44 & N-Judah.",
        "capacity_baseline": 5000,
        "transit_weight": 0.30,
        "tourist_weight": 0.90,
        "gtfs_stop_ids": ["15340", "15341"]
    },
    {
        "id": "SF_CHINATOWN_GATE",
        "name": "Chinatown Dragon Gate & Rose Pak Station",
        "category": "cultural_hub",
        "lat": 37.7908,
        "lng": -122.4058,
        "description": "Historic gateway to North America's oldest Chinatown, now directly linked to SF subway grid via the new Chinatown-Rose Pak station.",
        "capacity_baseline": 5500,
        "transit_weight": 0.55,
        "tourist_weight": 0.85,
        "gtfs_stop_ids": ["17873", "17874"]
    }
]

# Historical Data Generation Parameters
HISTORICAL_DAYS = 90  # 90 days of hourly observations (~2,160 hours per node = ~15,120 records)
FORECAST_HORIZON_HOURS = 48  # 48 hours ahead predictions
