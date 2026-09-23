"""
Module 2 Verification Script: Modeling & SHAP Explainability.
Tests XGBoost training, seasonal SARIMA baseline comparison,
TreeSHAP explainability factor extraction, and 48-hour forward forecast generation.
"""
import sys
import json
from pathlib import Path

# Add workspace root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data_pipeline.config import NODES
from data_pipeline.db_storage import get_connection
from ml_service.train_model import train_and_evaluate, MODEL_FILE, META_FILE
from ml_service.explainability import get_explainer, explain_features
from ml_service.forecast_generator import generate_forecasts

def verify_module_2():
    print("=" * 70)
    print("RUNNING MODULE 2 VERIFICATION: XGBOOST & SHAP EXPLAINABILITY PIPELINE")
    print("=" * 70)

    # 1. Train Model & Check Benchmarks
    print("\n[Step 1/4] Training XGBoost model and evaluating against Seasonal SARIMA baseline...")
    model, df = train_and_evaluate()
    assert MODEL_FILE.exists(), f"Model file {MODEL_FILE} was not created!"
    assert META_FILE.exists(), f"Metadata file {META_FILE} was not created!"

    with open(META_FILE, "r") as f:
        meta = json.load(f)
    xgb_mae = meta["metrics"]["test_mae"]
    base_mae = meta["metrics"]["baseline_mae"]
    print(f"  [OK] Model trained. XGBoost MAE: {xgb_mae:.2f} vs Baseline MAE: {base_mae:.2f}")
    assert xgb_mae < base_mae, f"XGBoost MAE ({xgb_mae:.2f}) should improve over baseline ({base_mae:.2f})!"

    # 2. Test TreeSHAP Explainer
    print("\n[Step 2/4] Testing TreeSHAP explanation extraction...")
    explainer, loaded_model = get_explainer()
    sample_row = df.iloc[-1]
    explanation = explain_features(sample_row)

    assert "base_value" in explanation, "Missing base_value in SHAP explanation!"
    assert "top_positive_factors" in explanation, "Missing top_positive_factors!"
    assert "top_negative_factors" in explanation, "Missing top_negative_factors!"
    assert len(explanation["top_positive_factors"]) > 0, "Top positive factors list is empty!"
    assert len(explanation["top_negative_factors"]) > 0, "Top negative factors list is empty!"

    print(f"  [OK] SHAP base value: {explanation['base_value']}, Predicted: {explanation['predicted_score']}")
    print(f"  [OK] Top congestion driver: '{explanation['top_positive_factors'][0]['feature_name']}' (+{explanation['top_positive_factors'][0]['impact']})")
    print(f"  [OK] Top relief factor: '{explanation['top_negative_factors'][0]['feature_name']}' ({explanation['top_negative_factors'][0]['impact']})")

    # 3. Test 48-Hour Forecast Generation
    print("\n[Step 3/4] Generating 48-hour forward forecast with hourly SHAP attributions...")
    forecast_records = generate_forecasts(horizon_hours=48)
    expected_total = len(NODES) * 48
    assert len(forecast_records) == expected_total, f"Expected {expected_total} forecasts, got {len(forecast_records)}"
    
    # Check bounds
    for rec in forecast_records:
        assert 0.0 <= rec["predicted_congestion"] <= 100.0, f"Predicted congestion {rec['predicted_congestion']} out of bounds!"
        assert rec["risk_level"] in ["LOW", "MODERATE", "HIGH", "SEVERE"], f"Invalid risk level: {rec['risk_level']}"
        assert len(rec["top_positive_factors"]) > 0, "Forecast item missing top positive factors!"

    print(f"  [OK] Successfully generated {len(forecast_records)} hourly forecasts across {len(NODES)} nodes.")

    # 4. Verify Database Persistence of Forecasts
    print("\n[Step 4/4] Verifying forecast records in database...")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM forecasts")
    db_forecast_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM model_benchmarks")
    db_benchmark_count = cursor.fetchone()[0]
    conn.close()

    assert db_forecast_count == expected_total, f"Expected {expected_total} forecasts in DB, got {db_forecast_count}"
    assert db_benchmark_count >= 2, f"Expected at least 2 benchmark records in DB, got {db_benchmark_count}"
    print(f"  [OK] Database verified: {db_forecast_count} forecasts and {db_benchmark_count} benchmark entries persisted.")

    print("\n" + "=" * 70)
    print("MODULE 2 VERIFICATION PASSED: ALL ML & SHAP TESTS SUCCEEDED!")
    print("=" * 70)

if __name__ == "__main__":
    verify_module_2()
