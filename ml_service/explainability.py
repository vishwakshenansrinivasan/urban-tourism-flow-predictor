"""
SHAP Explainability Module for Congestion Forecasting.
Uses TreeSHAP to compute exact feature attribution for individual predictions,
mapping raw mathematical features to human-interpretable urban transit & tourism drivers.
"""
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import xgboost as xgb
import shap

# Add workspace root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml_service.train_model import MODEL_FILE
from data_pipeline.feature_engineer import FEATURE_COLUMNS

# Human-readable labels for features
FEATURE_HUMAN_LABELS = {
    "hour_sin": "Time of Day (Peak Window)",
    "hour_cos": "Time of Day (Diurnal Cycle)",
    "dow_sin": "Weekly Schedule Cycle",
    "dow_cos": "Day of Week Alignment",
    "is_weekend": "Weekend Tourist Surge",
    "scheduled_trips": "Transit Dispatch Frequency",
    "temp_c": "Ambient Temperature",
    "humidity_pct": "Marine Layer / Humidity",
    "precip_mm": "Rainfall Intensity",
    "wind_speed_kmh": "Coastal Wind Speed",
    "is_rain": "Rain Weather Friction",
    "capacity_baseline": "Station Theoretical Capacity",
    "transit_weight": "Transit Commuter Dominance",
    "tourist_weight": "Tourist Landmark Dominance",
    "lag_1": "Recent Congestion (1h ago)",
    "lag_2": "Short-term Congestion (2h ago)",
    "lag_3": "Short-term Congestion (3h ago)",
    "lag_24": "Yesterday's Same-Hour Congestion",
    "lag_168": "Same Time Last Week Congestion",
    "lag_foot_1": "Recent Foot-Traffic (1h ago)",
    "lag_foot_24": "Yesterday's Foot-Traffic",
    "lag_trips_1": "Recent Transit Trips Count",
    "lag_trips_24": "Yesterday's Scheduled Transit Trips",
    "roll_mean_3h": "3-Hour Moving Congestion Trend",
    "roll_mean_6h": "6-Hour Moving Congestion Trend",
    "roll_mean_24h": "24-Hour Average Baseline",
    "roll_std_24h": "24-Hour Crowd Volatility",
    "rain_weekend_interaction": "Rainstorm x Weekend Suppression",
    "transit_pressure_ratio": "Transit Demand-to-Supply Ratio"
}

_EXPLAINER_INSTANCE = None
_MODEL_INSTANCE = None

def get_explainer():
    """Singleton getter for the TreeSHAP explainer and model."""
    global _EXPLAINER_INSTANCE, _MODEL_INSTANCE
    if _EXPLAINER_INSTANCE is None:
        if not MODEL_FILE.exists():
            raise FileNotFoundError(f"Model file {MODEL_FILE} not found. Train model first.")
        _MODEL_INSTANCE = xgb.XGBRegressor()
        _MODEL_INSTANCE.load_model(str(MODEL_FILE))
        _EXPLAINER_INSTANCE = shap.TreeExplainer(_MODEL_INSTANCE)
    return _EXPLAINER_INSTANCE, _MODEL_INSTANCE

def explain_features(feature_row: pd.Series or dict) -> dict:
    """
    Computes SHAP value attributions for a single observation row.
    Returns:
      - base_value: expected baseline prediction
      - predicted_score: calculated prediction
      - top_positive_factors: top drivers pushing congestion UP
      - top_negative_factors: top relief factors pulling congestion DOWN
      - all_contributions: list of all feature contributions
    """
    explainer, model = get_explainer()

    if isinstance(feature_row, dict):
        df_row = pd.DataFrame([feature_row])[FEATURE_COLUMNS]
    elif isinstance(feature_row, pd.Series):
        df_row = pd.DataFrame([feature_row[FEATURE_COLUMNS]])
    else:
        df_row = pd.DataFrame(feature_row)[FEATURE_COLUMNS]

    # Compute SHAP values
    shap_vals = explainer.shap_values(df_row)[0]
    base_val = float(explainer.expected_value)
    pred_val = float(np.clip(base_val + np.sum(shap_vals), 0.0, 100.0))

    contributions = []
    for col, val, shap_val in zip(FEATURE_COLUMNS, df_row.iloc[0], shap_vals):
        contributions.append({
            "feature_key": col,
            "feature_name": FEATURE_HUMAN_LABELS.get(col, col),
            "feature_value": round(float(val), 2),
            "shap_value": round(float(shap_val), 2),
            "impact": round(float(shap_val), 2)
        })

    # Sort positive drivers (highest impact first)
    positive_factors = sorted(
        [c for c in contributions if c["shap_value"] > 0],
        key=lambda x: x["shap_value"],
        reverse=True
    )

    # Sort negative relief factors (most negative impact first)
    negative_factors = sorted(
        [c for c in contributions if c["shap_value"] < 0],
        key=lambda x: x["shap_value"]
    )

    return {
        "base_value": round(base_val, 2),
        "predicted_score": round(pred_val, 1),
        "top_positive_factors": positive_factors[:5],
        "top_negative_factors": negative_factors[:5],
        "all_contributions": contributions
    }

if __name__ == "__main__":
    from ml_service.train_model import train_and_evaluate
    model, df = train_and_evaluate()
    sample = df.iloc[-1]
    explanation = explain_features(sample)
    print("\nSHAP Explanation Sample for Last Record:")
    print(f"Base Value: {explanation['base_value']} | Predicted Congestion: {explanation['predicted_score']}")
    print("\nTop Congestion Drivers (+):")
    for item in explanation["top_positive_factors"]:
        print(f"  + {item['feature_name']}: +{item['shap_value']} (Val: {item['feature_value']})")
    print("\nTop Relief Factors (-):")
    for item in explanation["top_negative_factors"]:
        print(f"  - {item['feature_name']}: {item['shap_value']} (Val: {item['feature_value']})")
