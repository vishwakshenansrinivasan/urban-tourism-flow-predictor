"""
GTFS Ingestion Module for San Francisco Transit Grid.
Loads or generates standard GTFS static tables (stops, routes, trips, stop_times, calendar)
and computes hourly scheduled transit frequency and departures per hub node.
"""
import os
import zipfile
import urllib.request
import pandas as pd
import numpy as np
from pathlib import Path
from data_pipeline.config import RAW_GTFS_DIR, NODES

# Public SFMTA GTFS feed URL
SFMTA_GTFS_URL = "https://www.sfmta.com/getting-around/transit/developer-resources/gtfs/google_transit.zip"

def ensure_gtfs_dataset():
    """
    Ensures GTFS feed files are available in RAW_GTFS_DIR.
    Attempts download from SFMTA public feed; if unavailable, generates a valid
    standard GTFS static dataset representing SFMTA Muni Metro, F-Market,
    Cable Cars, Central Subway, and bus lines servicing the 7 hub nodes.
    """
    stops_file = RAW_GTFS_DIR / "stops.txt"
    stop_times_file = RAW_GTFS_DIR / "stop_times.txt"
    trips_file = RAW_GTFS_DIR / "trips.txt"
    routes_file = RAW_GTFS_DIR / "routes.txt"
    calendar_file = RAW_GTFS_DIR / "calendar.txt"

    if stops_file.exists() and stop_times_file.exists() and trips_file.exists():
        return

    # Attempt download from SFMTA
    download_success = False
    zip_path = RAW_GTFS_DIR / "google_transit.zip"
    try:
        req = urllib.request.Request(
            SFMTA_GTFS_URL,
            headers={"User-Agent": "UrbanFlowPredictor/1.0 (TransitResearch)"}
        )
        with urllib.request.urlopen(req, timeout=10) as response, open(zip_path, 'wb') as out_file:
            out_file.write(response.read())
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(RAW_GTFS_DIR)
        download_success = True
        print("[GTFS] Successfully downloaded and extracted official SFMTA GTFS feed.")
    except Exception as e:
        print(f"[GTFS] Live GTFS download skipped or unreachable ({e}). Synthesizing realistic standard GTFS dataset.")

    if not download_success:
        _generate_standard_gtfs_dataset()

def _generate_standard_gtfs_dataset():
    """Generates standard GTFS static CSVs with realistic SFMTA schedules."""
    # 1. routes.txt
    routes = [
        {"route_id": "MUNI_METRO_K_T", "route_short_name": "KT", "route_long_name": "Ingleside / Third St Light Rail", "route_type": 0},
        {"route_id": "MUNI_METRO_N", "route_short_name": "N", "route_long_name": "Judah Light Rail", "route_type": 0},
        {"route_id": "MUNI_F_MARKET", "route_short_name": "F", "route_long_name": "Market & Wharves Historic Streetcar", "route_type": 0},
        {"route_id": "MUNI_CABLE_CAR_PH", "route_short_name": "PH", "route_long_name": "Powell / Hyde Cable Car", "route_type": 0},
        {"route_id": "MUNI_CABLE_CAR_PM", "route_short_name": "PM", "route_long_name": "Powell / Mason Cable Car", "route_type": 0},
        {"route_id": "MUNI_BUS_44", "route_short_name": "44", "route_long_name": "O'Shaughnessy / GGP Concourse", "route_type": 3},
        {"route_id": "MUNI_T_CENTRAL", "route_short_name": "T", "route_long_name": "Central Subway (Rose Pak - Union Sq - Mission Bay)", "route_type": 0},
        {"route_id": "BART_CORE", "route_short_name": "BART", "route_long_name": "Transbay & Market St Subway Trunk", "route_type": 1},
    ]
    pd.DataFrame(routes).to_csv(RAW_GTFS_DIR / "routes.txt", index=False)

    # 2. stops.txt
    stops = []
    for node in NODES:
        for idx, stop_id in enumerate(node["gtfs_stop_ids"]):
            stops.append({
                "stop_id": stop_id,
                "stop_name": f"{node['name']} - Platform {idx + 1}",
                "stop_lat": node["lat"] + (idx * 0.0001),
                "stop_lon": node["lng"] + (idx * 0.0001),
                "zone_id": node["id"],
                "node_id": node["id"]
            })
    pd.DataFrame(stops).to_csv(RAW_GTFS_DIR / "stops.txt", index=False)

    # 3. calendar.txt
    calendar = [
        {"service_id": "WD_SERVICE", "monday": 1, "tuesday": 1, "wednesday": 1, "thursday": 1, "friday": 1, "saturday": 0, "sunday": 0, "start_date": "20260101", "end_date": "20261231"},
        {"service_id": "SAT_SERVICE", "monday": 0, "tuesday": 0, "wednesday": 0, "thursday": 0, "friday": 0, "saturday": 1, "sunday": 0, "start_date": "20260101", "end_date": "20261231"},
        {"service_id": "SUN_SERVICE", "monday": 0, "tuesday": 0, "wednesday": 0, "thursday": 0, "friday": 0, "saturday": 0, "sunday": 1, "start_date": "20260101", "end_date": "20261231"},
    ]
    pd.DataFrame(calendar).to_csv(RAW_GTFS_DIR / "calendar.txt", index=False)

    # 4. trips.txt and stop_times.txt
    # Generate schedule across hours 05:00 to 24:00 with peak/off-peak/weekend frequencies
    trips = []
    stop_times = []
    trip_counter = 1000

    # Node-to-route assignment
    node_routes = {
        "SF_POWELL_ST": ["MUNI_METRO_K_T", "MUNI_METRO_N", "MUNI_CABLE_CAR_PH", "MUNI_CABLE_CAR_PM", "BART_CORE"],
        "SF_FISHERMANS_WHARF": ["MUNI_F_MARKET", "MUNI_CABLE_CAR_PH", "MUNI_CABLE_CAR_PM"],
        "SF_EMBARCADERO": ["MUNI_METRO_K_T", "MUNI_METRO_N", "MUNI_F_MARKET", "BART_CORE"],
        "SF_UNION_SQUARE": ["MUNI_METRO_K_T", "MUNI_METRO_N", "MUNI_T_CENTRAL", "BART_CORE"],
        "SF_MISSION_DOLORES": ["MUNI_METRO_N", "BART_CORE"],
        "SF_GOLDEN_GATE_PARK": ["MUNI_METRO_N", "MUNI_BUS_44"],
        "SF_CHINATOWN_GATE": ["MUNI_T_CENTRAL", "MUNI_CABLE_CAR_PM"]
    }

    services = [("WD_SERVICE", 1.0), ("SAT_SERVICE", 0.75), ("SUN_SERVICE", 0.65)]

    for service_id, serv_mult in services:
        is_weekend = service_id in ["SAT_SERVICE", "SUN_SERVICE"]
        for hour in range(5, 24):
            for node in NODES:
                n_id = node["id"]
                stop_id = node["gtfs_stop_ids"][0]
                routes_for_node = node_routes.get(n_id, ["MUNI_METRO_K_T"])

                # Base headway logic
                if not is_weekend:
                    if 7 <= hour <= 9 or 16 <= hour <= 18:
                        trips_per_hour = int(22 * serv_mult)
                    elif 10 <= hour <= 15:
                        trips_per_hour = int(14 * serv_mult)
                    else:
                        trips_per_hour = int(8 * serv_mult)
                else:
                    # Weekend: tourist nodes peak 11am-18pm
                    if "WHARF" in n_id or "PARK" in n_id or "CHINATOWN" in n_id:
                        trips_per_hour = int(18 * serv_mult) if 11 <= hour <= 18 else int(10 * serv_mult)
                    else:
                        trips_per_hour = int(12 * serv_mult)

                # Create trip records
                for t_idx in range(trips_per_hour):
                    trip_counter += 1
                    t_id = f"T_{trip_counter}"
                    r_id = routes_for_node[t_idx % len(routes_for_node)]
                    trips.append({
                        "route_id": r_id,
                        "service_id": service_id,
                        "trip_id": t_id,
                        "trip_headsign": f"Inbound / Outbound {r_id}",
                        "direction_id": t_idx % 2
                    })
                    minute = int((60 / max(1, trips_per_hour)) * t_idx)
                    arr_time = f"{hour:02d}:{minute:02d}:00"
                    stop_times.append({
                        "trip_id": t_id,
                        "arrival_time": arr_time,
                        "departure_time": arr_time,
                        "stop_id": stop_id,
                        "stop_sequence": 1
                    })

    pd.DataFrame(trips).to_csv(RAW_GTFS_DIR / "trips.txt", index=False)
    pd.DataFrame(stop_times).to_csv(RAW_GTFS_DIR / "stop_times.txt", index=False)
    print(f"[GTFS] Synthetic static GTFS feed created ({len(trips)} trips, {len(stop_times)} stop times).")


def extract_scheduled_transit_frequencies():
    """
    Parses the GTFS tables and returns an hourly schedule baseline matrix:
    DataFrame with columns: [node_id, day_of_week, hour, scheduled_trips]
    where day_of_week is 0 (Mon) to 6 (Sun).
    """
    ensure_gtfs_dataset()

    stops_df = pd.read_csv(RAW_GTFS_DIR / "stops.txt", dtype=str)
    stop_times_df = pd.read_csv(RAW_GTFS_DIR / "stop_times.txt", dtype=str)
    trips_df = pd.read_csv(RAW_GTFS_DIR / "trips.txt", dtype=str)
    calendar_df = pd.read_csv(RAW_GTFS_DIR / "calendar.txt", dtype=str)

    # Map stop_id to node_id
    stop_to_node = {}
    for node in NODES:
        for sid in node["gtfs_stop_ids"]:
            stop_to_node[str(sid)] = node["id"]

    # Filter stop_times for our stops
    stop_times_df["node_id"] = stop_times_df["stop_id"].map(stop_to_node)
    matched_st = stop_times_df.dropna(subset=["node_id"]).copy()

    # Extract departure hour
    matched_st["dep_hour"] = matched_st["departure_time"].apply(lambda x: int(str(x).split(":")[0]) if pd.notna(x) and ":" in str(x) else 0)

    # Join with trips to get service_id
    merged = matched_st.merge(trips_df[["trip_id", "service_id"]], on="trip_id", how="inner")
    merged = merged.merge(calendar_df, on="service_id", how="inner")

    # Map service_id to day-of-week active flags
    records = []
    day_cols = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    for dow_idx, day_col in enumerate(day_cols):
        active_trips = merged[merged[day_col] == "1"]
        freq = active_trips.groupby(["node_id", "dep_hour"]).size().reset_index(name="scheduled_trips")
        freq["day_of_week"] = dow_idx
        freq.rename(columns={"dep_hour": "hour"}, inplace=True)
        records.append(freq)

    result_df = pd.concat(records, ignore_index=True)

    # Ensure all combinations of (node_id, day_of_week, hour) exist
    all_combinations = pd.MultiIndex.from_product(
        [[n["id"] for n in NODES], list(range(7)), list(range(24))],
        names=["node_id", "day_of_week", "hour"]
    ).to_frame().reset_index(drop=True)

    final_df = all_combinations.merge(result_df, on=["node_id", "day_of_week", "hour"], how="left")
    final_df["scheduled_trips"] = final_df["scheduled_trips"].fillna(2).astype(int)

    return final_df

if __name__ == "__main__":
    ensure_gtfs_dataset()
    freq_df = extract_scheduled_transit_frequencies()
    print("Extracted scheduled transit sample:")
    print(freq_df.head(15))
    print(f"Total schedule profile records: {len(freq_df)}")
