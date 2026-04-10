"""Generate detector time-series JSON files for the Seerflow Guide viz.

Uses synthetic data (numpy) to match the shape of real detector output.
This is the 'fallback' path from the S-139H plan — chosen over importing
the live seerflow package because detector APIs evolve and the guide
should be reproducible without a live seerflow install.

Each function writes one JSON file under docs/assets/viz-data/detector-ts/
with this shape:

    {
      "detector_name": str,
      "timestamps": [iso str, ...],
      "values": [float, ...],
      "threshold_upper": [float, ...],
      "threshold_lower": [float, ...] | absent,
      "anomaly_indices": [int, ...],
      "y_axis_label": str
    }

Usage:
    cd seerflow-guide
    pip install -r dev-requirements.txt
    python scripts/gen_viz_data.py
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np


OUTPUT_DIR = (
    Path(__file__).resolve().parent.parent / "docs" / "assets" / "viz-data" / "detector-ts"
)
RNG_SEED = 2026
N_POINTS = 240  # 4 hours at 1-minute resolution
START = datetime(2026, 4, 10, 0, 0, tzinfo=timezone.utc)
ANOMALY_INDEX = 180


def iso_timestamps(n: int) -> list[str]:
    return [(START + timedelta(minutes=i)).isoformat() for i in range(n)]


def write_json(name: str, payload: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / f"{name}.json"
    out.write_text(json.dumps(payload, indent=2))
    print(f"wrote {out}")


def gen_hst() -> None:
    """HST: novel content detection. Baseline ~0.3, spike near 0.92."""
    # fallback: synthesized rather than running HalfSpaceTrees directly
    rng = np.random.default_rng(RNG_SEED)
    values = rng.normal(0.30, 0.05, size=N_POINTS)
    values = np.clip(values, 0.0, 1.0)
    values[ANOMALY_INDEX] = 0.92
    values[ANOMALY_INDEX + 1] = 0.81
    threshold = np.full(N_POINTS, 0.75)
    anomaly_indices = [i for i, v in enumerate(values) if v > threshold[i]]
    write_json(
        "hst",
        {
            "detector_name": "Half-Space Trees",
            "timestamps": iso_timestamps(N_POINTS),
            "values": [round(float(v), 4) for v in values],
            "threshold_upper": [round(float(t), 4) for t in threshold],
            "anomaly_indices": anomaly_indices,
            "y_axis_label": "HST anomaly score",
        },
    )


def gen_holt_winters() -> None:
    """Holt-Winters: volume with seasonal baseline plus spike at anomaly index."""
    # fallback: synthesized sinusoidal baseline plus gaussian noise and a spike
    rng = np.random.default_rng(RNG_SEED + 1)
    t = np.arange(N_POINTS)
    seasonal = 100.0 + 30.0 * np.sin(2 * np.pi * t / 60.0)
    noise = rng.normal(0.0, 5.0, size=N_POINTS)
    values = seasonal + noise
    values[ANOMALY_INDEX] += 220.0
    # Prediction band: +/- 25 from seasonal baseline
    upper = seasonal + 25.0
    lower = seasonal - 25.0
    anomaly_indices = [i for i, v in enumerate(values) if v > upper[i] or v < lower[i]]
    write_json(
        "holt-winters",
        {
            "detector_name": "Holt-Winters",
            "timestamps": iso_timestamps(N_POINTS),
            "values": [round(float(v), 2) for v in values],
            "threshold_upper": [round(float(u), 2) for u in upper],
            "threshold_lower": [round(float(l), 2) for l in lower],
            "anomaly_indices": anomaly_indices,
            "y_axis_label": "Events per minute",
        },
    )


def gen_cusum() -> None:
    """CUSUM: mean shift at t=120. Cumulative sum crosses threshold shortly after."""
    # fallback: synthesized CUSUM statistic from a piecewise-normal stream
    rng = np.random.default_rng(RNG_SEED + 2)
    observations = np.concatenate(
        [
            rng.normal(0.0, 0.3, size=120),
            rng.normal(0.8, 0.3, size=N_POINTS - 120),
        ]
    )
    cusum = np.zeros(N_POINTS)
    k = 0.2  # reference value (half the target shift)
    s_pos = 0.0
    for i, x in enumerate(observations):
        s_pos = max(0.0, s_pos + x - k)
        cusum[i] = s_pos
    threshold = np.full(N_POINTS, 5.0)
    anomaly_indices = [i for i, v in enumerate(cusum) if v > threshold[i]]
    write_json(
        "cusum",
        {
            "detector_name": "CUSUM",
            "timestamps": iso_timestamps(N_POINTS),
            "values": [round(float(v), 4) for v in cusum],
            "threshold_upper": [round(float(t), 4) for t in threshold],
            "anomaly_indices": anomaly_indices,
            "y_axis_label": "CUSUM statistic",
        },
    )


def gen_markov() -> None:
    """Markov sequence anomaly: low-probability transition at t=180."""
    # fallback: synthesized transition probabilities
    rng = np.random.default_rng(RNG_SEED + 3)
    values = rng.uniform(0.0, 0.5, size=N_POINTS)
    values[ANOMALY_INDEX] = 0.82
    values[ANOMALY_INDEX + 1] = 0.71
    threshold = np.full(N_POINTS, 0.65)
    anomaly_indices = [i for i, v in enumerate(values) if v > threshold[i]]
    write_json(
        "markov",
        {
            "detector_name": "Markov chain",
            "timestamps": iso_timestamps(N_POINTS),
            "values": [round(float(v), 4) for v in values],
            "threshold_upper": [round(float(t), 4) for t in threshold],
            "anomaly_indices": anomaly_indices,
            "y_axis_label": "Transition anomaly score",
        },
    )


def gen_dspot() -> None:
    """DSPOT: EVT-derived adaptive threshold tracks the stream and adapts slowly."""
    # fallback: synthesized blended score stream with slowly adapting threshold
    rng = np.random.default_rng(RNG_SEED + 4)
    stream = rng.gamma(shape=2.0, scale=0.1, size=N_POINTS)
    stream[ANOMALY_INDEX] = 1.40
    # Adaptive threshold: slowly growing upper quantile estimate
    threshold = np.zeros(N_POINTS)
    warmup = 30
    for i in range(N_POINTS):
        if i < warmup:
            threshold[i] = 0.55
        else:
            window = stream[max(0, i - warmup): i]
            threshold[i] = float(np.quantile(window, 0.98)) + 0.15
    anomaly_indices = [i for i, v in enumerate(stream) if v > threshold[i]]
    write_json(
        "dspot",
        {
            "detector_name": "DSPOT",
            "timestamps": iso_timestamps(N_POINTS),
            "values": [round(float(v), 4) for v in stream],
            "threshold_upper": [round(float(t), 4) for t in threshold],
            "anomaly_indices": anomaly_indices,
            "y_axis_label": "Blended score",
        },
    )


def main() -> None:
    gen_hst()
    gen_holt_winters()
    gen_cusum()
    gen_markov()
    gen_dspot()
    print(f"wrote 5 files under {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
