import json
import subprocess
import sys

import pytest

from physics_worker.simulate import run
from physics_worker.spec import SpecError

from .conftest import make_body, make_spec, pose


def box_drop_spec(count=30, seeds=3):
    return make_spec(
        [
            make_body(
                "box",
                count=count,
                shape={"type": "box", "size": [0.2, 0.3, 0.15]},
                mass={"min": 1, "max": 5},
                placement={
                    "type": "region",
                    "center": [0, 0, 1.5],
                    "size": [1, 1, 2],
                    "randomRotation": True,
                },
            )
        ],
        seeds=seeds,
        simulation={"duration": 3},
    )


def test_dropped_boxes_settle_on_the_ground():
    trajectory = run(box_drop_spec(), 1)
    stats = trajectory["stats"]

    assert len(trajectory["bodies"]) == 30
    assert stats["settled"]
    assert stats["belowGround"] == []
    assert stats["initialPenetration"] == 0
    # Impacts at several m/s overlap briefly; this bounds how far.
    assert stats["maxPenetration"] < 0.02
    assert stats["energyEnd"] < stats["energyStart"]


def test_same_seed_gives_the_same_run_and_another_seed_does_not():
    spec = box_drop_spec(count=5)

    first, again, other = run(spec, 0), run(spec, 0), run(spec, 1)

    assert first == again
    assert first["frames"][0]["poses"] != other["frames"][0]["poses"]
    assert [body["mass"] for body in first["bodies"]] != [
        body["mass"] for body in other["bodies"]
    ]


def test_frames_follow_capture_rate():
    trajectory = run(make_spec([make_body()], simulation={"duration": 1, "captureHz": 30}), 0)

    times = [frame["t"] for frame in trajectory["frames"]]

    assert len(times) == 31
    assert times[0] == 0
    assert times[-1] == pytest.approx(1, abs=0.002)


def test_world_frame_angular_velocity_survives_initial_rotation():
    spec = make_spec(
        [
            make_body(
                shape={"type": "box", "size": [0.2, 0.2, 0.2]},
                placement=pose([0, 0, 1], (0, 90, 0)),
                angularVelocity=[0, 0, 3],
            )
        ],
        ground=None,
        gravity=[0, 0, 0],
    )

    velocity = run(spec, 0)["frames"][0]["velocities"][0]

    assert velocity[3:] == pytest.approx([0, 0, 3], abs=1e-6)


def test_rejects_spec_that_does_not_match_schema():
    spec = make_spec([make_body(mass=-1)])

    with pytest.raises(SpecError, match="bodies/0/mass"):
        run(spec, 0)


def test_rejects_seed_outside_spec_range():
    with pytest.raises(SpecError, match="outside the spec's range"):
        run(make_spec([make_body()], seeds=2), 2)


def test_rejects_bodies_overlapping_at_start():
    spec = make_spec(
        [
            make_body("a", placement=pose([0, 0, 1])),
            make_body("b", placement=pose([0.05, 0, 1])),
        ]
    )

    with pytest.raises(SpecError, match="overlap by"):
        run(spec, 0)


def test_rejects_region_too_small_for_its_bodies():
    spec = make_spec(
        [
            make_body(
                count=50,
                placement={
                    "type": "region",
                    "center": [0, 0, 1],
                    "size": [0.3, 0.3, 0.3],
                    "randomRotation": False,
                },
            )
        ]
    )

    with pytest.raises(SpecError, match="Could not place"):
        run(spec, 0)


def test_cli_exits_2_with_reason_on_invalid_spec():
    result = subprocess.run(
        [sys.executable, "-m", "physics_worker", "-", "--seed", "0"],
        input=json.dumps(make_spec([make_body(mass=-1)])),
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    assert "Invalid scene spec" in result.stderr
