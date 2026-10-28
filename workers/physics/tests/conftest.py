import json
import subprocess
from pathlib import Path

import numpy as np
import pytest

CATALOG = Path(__file__).with_name("catalog.mjs")


def make_spec(bodies, **overrides):
    """A complete spec, as `SceneSpec.parse` would hand it over."""
    spec = {
        "version": 1,
        "gravity": [0, 0, -9.81],
        "ground": {"friction": 0.8},
        "fixtures": [],
        "bodies": bodies,
        "cameras": [],
        "simulation": {"duration": 1, "timestep": 0.002, "captureHz": 30},
        "seeds": 1,
    }
    simulation = overrides.pop("simulation", {})
    spec.update(overrides)
    spec["simulation"] = {**spec["simulation"], **simulation}
    return spec


def make_body(body_id="body", **overrides):
    body = {
        "id": body_id,
        "label": body_id,
        "count": 1,
        "shape": {"type": "sphere", "radius": 0.1},
        "mass": 1,
        "friction": 0.8,
        "placement": {"type": "pose", "pose": {"position": [0, 0, 1], "rotationDeg": [0, 0, 0]}},
        "linearVelocity": [0, 0, 0],
        "angularVelocity": [0, 0, 0],
    }
    body.update(overrides)
    return body


def pose(position, rotation_deg=(0, 0, 0)):
    return {"type": "pose", "pose": {"position": list(position), "rotationDeg": list(rotation_deg)}}


def positions(trajectory, body_index=0):
    """(times, xyz positions) of one body across the trajectory."""
    times = np.array([frame["t"] for frame in trajectory["frames"]])
    xyz = np.array([frame["poses"][body_index][:3] for frame in trajectory["frames"]])
    return times, xyz


@pytest.fixture
def catalog():
    """Runs a solver from the JS physics catalog and returns its result."""

    def solve(solver, **options):
        result = subprocess.run(
            ["node", str(CATALOG), json.dumps({"solver": solver, "options": options})],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)

    return solve


def quantity(value, unit):
    return {"value": value, "unit": unit}
