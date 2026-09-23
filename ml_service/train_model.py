"""
Model Training & Benchmark Evaluation Module.
Trains an XGBoost Regressor on engineered spatio-temporal features to forecast
the 0-100 congestion/bottleneck score. Evaluates against a SARIMA / Seasonal Persistence benchmark.
Saves model artifact and writes evaluation metrics to the database.
"""
import os
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb

# Add workspace root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data_pipeline.config import BASE_DIR, NODES
from data_pipeline.traffic_synthesizer import synthesize_historical_dataset
from data_pipeline.feature_engineer import build_features, FEATURE_COLUMNS, TARGET_COLUMN
from data_pipeline.db_storage import save_benchmark, init_database, save_hourly_metrics

MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_FILE = MODELS_DIR / "xgboost_congestion.json"
META_FILE = MODELS_DIR / "model_metadata.json"

def train_and_evaluate(df: pd.DataFrame = None):
    """
    Trains XGBoost on temporal train/validation/test split.
    Computes performance comparison against a Seasonal Baseline (SARIMA proxy).
    """
    if df is None:
        print("[ML] Generating historical dataset for training...")
        raw_df = synthesize_historical_dataset()
        init_database()
        save_hourly_metrics(raw_df)
        df = build_features(raw_df)

    print(f"[ML] Total dataset size: {len(df)} records across {len(NODES)} nodes.")

    # Sort strictly by timestamp to prevent future leakage
    df = df.sort_values("timestamp").reset_index(drop=True)

    # 70% Train, 15% Validation, 15% Test
    n = len(df)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)

    train_df = df.iloc[:train_end]
    val_df = df.iloc[train_end:val_end]
    test_df = df.iloc[val_end:]

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df[TARGET_COLUMN]
    X_val, y_val = val_df[FEATURE_COLUMNS], val_df[TARGET_COLUMN]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df[TARGET_COLUMN]

    print(f"[ML] Splits: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    # 1. Benchmark: Seasonal Persistence / SARIMA baseline (predicting lag_168 same hour last week)
    # This represents the standard statistical seasonal baseline for 168-hour (weekly) transit cycles.
    baseline_preds = test_df["lag_168"].values
    baseline_mae = float(mean_absolute_error(y_test, baseline_preds))
    baseline_rmse = float(np.sqrt(mean_squared_error(y_test, baseline_preds)))
    baseline_r2 = float(r2_score(y_test, baseline_preds))

    print(f"\n[Benchmark: Seasonal Persistence / SARIMA Baseline]")
    print(f"  MAE:  {baseline_mae:.2f}")
    print(f"  RMSE: {baseline_rmse:.2f}")
    print(f"  R2:   {baseline_r2:.4f}")
    save_benchmark("Seasonal_SARIMA_Baseline", baseline_mae, baseline_rmse, baseline_r2, "Weekly lag-168 seasonal benchmark")

    # 2. Production Model: XGBoost Regressor
    print("\n[ML] Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=250,
        learning_rate=0.04,
        max_depth=6,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        objective="reg:squarederror",
        random_state=42,
        tree_method="hist",
        early_stopping_rounds=25
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )

    # 3. Test Evaluation
    xgb_preds = model.predict(X_test)
    xgb_preds = np.clip(xgb_preds, 0.0, 100.0)

    xgb_mae = float(mean_absolute_error(y_test, xgb_preds))
    xgb_rmse = float(np.sqrt(mean_squared_error(y_test, xgb_preds)))
    xgb_r2 = float(r2_score(y_test, xgb_preds))

    print(f"\n[Production Model: XGBoost Regressor]")
    print(f"  MAE:  {xgb_mae:.2f}")
    print(f"  RMSE: {xgb_rmse:.2f}")
    print(f"  R2:   {xgb_r2:.4f}")
    print(f"  Improvement over Baseline: MAE reduced by {((baseline_mae - xgb_mae) / baseline_mae) * 100:.1f}%")

    save_benchmark("XGBoost_Tabular_Production", xgb_mae, xgb_rmse, xgb_r2, f"Trained on {len(FEATURE_COLUMNS)} spatio-temporal features")

    # 4. Save Model Artifact and Metadata
    model.save_model(str(MODEL_FILE))
    
    metadata = {
        "model_name": "XGBoost_Congestion_Predictor",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_features": len(FEATURE_COLUMNS),
        "features": FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "metrics": {
            "test_mae": xgb_mae,
            "test_rmse": xgb_rmse,
            "test_r2": xgb_r2,
            "baseline_mae": baseline_mae,
            "baseline_rmse": baseline_rmse,
            "baseline_r2": baseline_r2
        }
    }
    with open(META_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"[ML] Model saved to {MODEL_FILE}")
    print(f"[ML] Metadata saved to {META_FILE}")

    return model, df

if __name__ == "__main__":
    train_and_evaluate()
