"""
Configuration for Urban Tourism and Transit Flow Predictor (Chennai Hubs)
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

# OpenWeatherMap API Key (optional - falls back to realistic Chennai meteorological simulation)
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")

# City Metadata
CITY_NAME = "Chennai"
CITY_CENTER = {"lat": 13.0827, "lng": 80.2707}

# Selected 12 Landmark & Transit Hub Nodes across Chennai Metropolitan Area
NODES = [
    {
        "id": "MAA_CENTRAL_STATION",
        "name": "Puratchi Thalaivar Dr. M.G.R. Central & Metro Hub",
        "category": "transit_hub",
        "lat": 13.0827,
        "lng": 80.2755,
        "description": "Premier multi-modal transport gateway connecting Southern Railway mainlines, Chennai Central Metro underground interchange, and suburban EMU trains.",
        "capacity_baseline": 12000,
        "transit_weight": 0.90,
        "tourist_weight": 0.65,
        "gtfs_stop_ids": ["MAS01", "MAS02", "CMRL_CEN"]
    },
    {
        "id": "MAA_MARINA_BEACH",
        "name": "Marina Beach & Light House Promenade",
        "category": "tourist_attraction",
        "lat": 13.0500,
        "lng": 80.2824,
        "description": "World's second longest natural urban beach along the Bay of Bengal, drawing massive evening leisure crowds, carnival vendors, and coastal tourists.",
        "capacity_baseline": 15000,
        "transit_weight": 0.35,
        "tourist_weight": 0.98,
        "gtfs_stop_ids": ["MTC_MRN01", "MTC_MRN02"]
    },
    {
        "id": "MAA_T_NAGAR_RANGANATHAN",
        "name": "T. Nagar Ranganathan Street & Panagal Park",
        "category": "commercial_hub",
        "lat": 13.0405,
        "lng": 80.2337,
        "description": "India's highest-revenue retail hub and silk-gold shopping corridor, directly linked to Mambalam Suburban Railway Station and MTC bus terminus.",
        "capacity_baseline": 14000,
        "transit_weight": 0.75,
        "tourist_weight": 0.90,
        "gtfs_stop_ids": ["MAM01", "MTC_TNG01"]
    },
    {
        "id": "MAA_MYLAPORE_KAPALEESHWARAR",
        "name": "Mylapore Kapaleeshwarar Temple & Tank",
        "category": "cultural_hub",
        "lat": 13.0335,
        "lng": 80.2690,
        "description": "7th-century Dravidian architectural masterpiece, cultural epicenter for Carnatic music, spiritual pilgrimages, and historic tank festival gatherings.",
        "capacity_baseline": 7500,
        "transit_weight": 0.45,
        "tourist_weight": 0.95,
        "gtfs_stop_ids": ["MTC_MYL01", "MTC_MYL02"]
    },
    {
        "id": "MAA_EGMORE_STATION",
        "name": "Chennai Egmore Junction & Government Museum",
        "category": "transit_hub",
        "lat": 13.0784,
        "lng": 80.2612,
        "description": "Gothic-style railway terminus for southern Tamil Nadu trains, integrated with Chennai Egmore Metro and nearby State Museum complex.",
        "capacity_baseline": 9500,
        "transit_weight": 0.85,
        "tourist_weight": 0.60,
        "gtfs_stop_ids": ["MS01", "CMRL_EGM"]
    },
    {
        "id": "MAA_BESANT_NAGAR_ELLIOTS",
        "name": "Besant Nagar Elliot's Beach & Church",
        "category": "leisure_hotspot",
        "lat": 12.9995,
        "lng": 80.2715,
        "description": "Picturesque south Chennai coastline with Schmidt Memorial, Velankanni Shrine, vibrant promenade cafes, and weekend youth recreational crowds.",
        "capacity_baseline": 8000,
        "transit_weight": 0.30,
        "tourist_weight": 0.88,
        "gtfs_stop_ids": ["MTC_BNG01", "MTC_BNG02"]
    },
    {
        "id": "MAA_GUINDY_INTERMODAL",
        "name": "Guindy Intermodal Hub & National Park",
        "category": "hybrid_hub",
        "lat": 13.0067,
        "lng": 80.2126,
        "description": "Major southern transit convergence linking CMRL Metro, suburban EMU, and MTC buses with Guindy National Park and industrial corridors.",
        "capacity_baseline": 11000,
        "transit_weight": 0.88,
        "tourist_weight": 0.55,
        "gtfs_stop_ids": ["GDY01", "CMRL_GDY"]
    },
    {
        "id": "MAA_AIRPORT_MEENAMBAKKAM",
        "name": "Chennai International Airport & Metro Terminal",
        "category": "transit_hub",
        "lat": 12.9815,
        "lng": 80.1636,
        "description": "International & domestic aviation gateway directly integrated with CMRL Blue Line terminal station, managing high intercity passenger flows.",
        "capacity_baseline": 8500,
        "transit_weight": 0.85,
        "tourist_weight": 0.70,
        "gtfs_stop_ids": ["CMRL_AIR01", "MTC_AIR01"]
    },
    {
        "id": "MAA_KATHIPARA_JUNCTION",
        "name": "Kathipara Urban Square & Alandur Interchange",
        "category": "hybrid_hub",
        "lat": 13.0076,
        "lng": 80.2018,
        "description": "Asia's largest cloverleaf interchange and key CMRL Blue/Green bidirectional elevated metro interchange with multimodal public plazas.",
        "capacity_baseline": 10500,
        "transit_weight": 0.90,
        "tourist_weight": 0.45,
        "gtfs_stop_ids": ["CMRL_ALN01", "CMRL_ALN02"]
    },
    {
        "id": "MAA_SANTHOME_BASILICA",
        "name": "San Thome Cathedral Basilica & Coast",
        "category": "cultural_attraction",
        "lat": 13.0336,
        "lng": 80.2785,
        "description": "Historic 16th-century Portuguese neo-Gothic Catholic cathedral built over the tomb of St. Thomas Apostle, prominent coastal heritage corridor.",
        "capacity_baseline": 6500,
        "transit_weight": 0.35,
        "tourist_weight": 0.92,
        "gtfs_stop_ids": ["MTC_STH01", "MTC_STH02"]
    },
    {
        "id": "MAA_KOYAMBEDU_CMBT",
        "name": "Koyambedu CMBT & Wholesale Market Hub",
        "category": "transit_hub",
        "lat": 13.0694,
        "lng": 80.1948,
        "description": "One of Asia's largest intercity bus terminus complexes, Koyambedu perishable goods market, and CMRL Green line metro station.",
        "capacity_baseline": 13500,
        "transit_weight": 0.92,
        "tourist_weight": 0.40,
        "gtfs_stop_ids": ["CMBT01", "CMRL_KYM"]
    },
    {
        "id": "MAA_PHOENIX_VELACHERY",
        "name": "Phoenix Marketcity & Velachery MRTS",
        "category": "commercial_hub",
        "lat": 12.9918,
        "lng": 80.2173,
        "description": "Premier retail and entertainment lifestyle mall in South Chennai, linked to Velachery MRTS elevated railway terminal and OMR IT expressway.",
        "capacity_baseline": 10000,
        "transit_weight": 0.65,
        "tourist_weight": 0.85,
        "gtfs_stop_ids": ["VLCY01", "MTC_PHX01"]
    }
]

# Historical Data Generation Parameters
HISTORICAL_DAYS = 180  # 180 days of hourly observations (~4,320 hours per node = ~51,840 records across 12 nodes)
FORECAST_HORIZON_HOURS = 48  # 48 hours ahead predictions
