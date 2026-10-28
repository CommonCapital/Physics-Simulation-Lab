"""MuJoCo against the analytic catalog.

Each benchmark builds the catalog solver's scenario as a scene spec, runs it
through the worker, and checks the two agree within a stated tolerance. These
tolerances are the published accuracy of the physics core: loosening one is a
decision, not a fix.
"""

import math

import numpy as np
import pytest

from physics_worker.simulate import run

from .conftest import make_body, make_spec, pose, positions, quantity

G = 9.81


def test_free_fall_matches_catalog(catalog):
    expected = catalog(
        "solveFreeFall",
        mass=quantity(2, "kg"),
        gravity=quantity(G, "m/s^2"),
        initialHeight=quantity(5, "m"),
        timeStep=quantity(0.05, "s"),
    )
    spec = make_spec(
        [make_body(mass=2, placement=pose([0, 0, 5]))],
        ground=None,
        simulation={"duration": 1.2, "timestep": 0.001, "captureHz": 1000},
    )

    times, xyz = positions(run(spec, 0))

    for sample in expected["samples"]:
        height = np.interp(sample["time"], times, xyz[:, 2])
        # Within 1 cm over a 5 m drop.
        assert height == pytest.approx(sample["position"], abs=0.01)


def test_projectile_matches_catalog(catalog):
    speed, angle = 10.0, math.radians(30)
    expected = catalog(
        "solveProjectileMotion",
        initialSpeed=quantity(speed, "m/s"),
        launchAngle=quantity(30, "deg"),
        initialHeight=quantity(2, "m"),
        gravitationalAcceleration=quantity(G, "m/s^2"),
        sampleCount=20,
    )
    spec = make_spec(
        [
            make_body(
                placement=pose([0, 0, 2]),
                linearVelocity=[speed * math.cos(angle), 0, speed * math.sin(angle)],
            )
        ],
        ground=None,
        simulation={"duration": 1.5, "timestep": 0.001, "captureHz": 1000},
    )

    times, xyz = positions(run(spec, 0))

    for sample in expected["trajectory"]:
        x = np.interp(sample["time"], times, xyz[:, 0])
        z = np.interp(sample["time"], times, xyz[:, 2])
        assert x == pytest.approx(sample["position"]["x"], abs=0.01)
        assert z == pytest.approx(sample["position"]["y"], abs=0.01)

    assert xyz[:, 2].max() == pytest.approx(expected["maximumHeight"], abs=0.01)


def incline_spec(friction, angle_deg):
    """A block resting on a ramp tilted `angle_deg` about y, uphill of centre."""
    angle = math.radians(angle_deg)
    # Rotating about +y tilts the ramp's +x end down.
    downhill = np.array([math.cos(angle), 0, -math.sin(angle)])
    normal = np.array([math.sin(angle), 0, math.cos(angle)])
    ramp_thickness, block_edge = 0.1, 0.2
    block_center = (
        np.array([0, 0, 5])
        - 1.5 * downhill
        + normal * (ramp_thickness / 2 + block_edge / 2)
    )

    spec = make_spec(
        [
            make_body(
                "block",
                shape={"type": "box", "size": [block_edge] * 3},
                friction=friction,
                placement=pose(block_center, (0, angle_deg, 0)),
            )
        ],
        ground=None,
        fixtures=[
            {
                "id": "ramp",
                "shape": {"type": "box", "size": [5, 1, ramp_thickness]},
                "pose": {"position": [0, 0, 5], "rotationDeg": [0, angle_deg, 0]},
                "friction": friction,
            }
        ],
        simulation={"duration": 1.0, "timestep": 0.001, "captureHz": 200},
    )
    return spec, downhill


def friction_case(catalog, friction, angle_deg):
    return catalog(
        "solveFriction",
        mass=quantity(1, "kg"),
        staticCoefficient=friction,
        kineticCoefficient=friction,
        angle=quantity(angle_deg, "deg"),
        gravity=quantity(G, "m/s^2"),
    )


def test_block_slides_down_incline_at_catalog_acceleration(catalog):
    expected = friction_case(catalog, friction=0.2, angle_deg=30)
    assert expected["isSliding"]

    spec, downhill = incline_spec(friction=0.2, angle_deg=30)
    times, xyz = positions(run(spec, 0))
    along = (xyz - xyz[0]) @ downhill

    # Skip the first 0.1 s, while the block settles onto the ramp.
    window = times >= 0.1
    acceleration = 2 * np.polyfit(times[window], along[window], 2)[0]

    # Within 2 % of the Coulomb-friction answer.
    assert acceleration == pytest.approx(expected["acceleration"], rel=0.02)


def test_block_holds_on_incline_below_critical_angle(catalog):
    expected = friction_case(catalog, friction=0.8, angle_deg=30)
    assert not expected["isSliding"]

    spec, downhill = incline_spec(friction=0.8, angle_deg=30)
    _, xyz = positions(run(spec, 0))
    creep = abs((xyz[-1] - xyz[0]) @ downhill)

    # Static friction holds: under 1 mm of creep in a second.
    assert creep < 0.001
