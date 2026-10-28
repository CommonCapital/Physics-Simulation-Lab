"""Turning a spec (a family of scenes) into one concrete scene for a seed.

Everything random about a run happens here and draws from one generator
seeded by the run's seed, so `(spec, seed)` always gives the same scene.
"""

import math
from dataclasses import dataclass

import numpy as np

from .spec import Spec, SpecError

# How many positions to try per body before giving up on a crowded region.
MAX_PLACEMENT_ATTEMPTS = 2000


@dataclass(frozen=True)
class Body:
    id: str
    set_id: str
    label: str
    shape: dict
    mass: float
    friction: float
    position: np.ndarray
    # Quaternion (w, x, y, z).
    quaternion: np.ndarray
    linear_velocity: np.ndarray
    # World frame, as the spec gives it.
    angular_velocity: np.ndarray


def sample_scene(spec: Spec, seed: int) -> list[Body]:
    rng = np.random.default_rng(seed)
    bodies: list[Body] = []
    # Centres and bounding radii of every body placed in a region so far.
    occupied: list[tuple[np.ndarray, float]] = []

    for body_set in spec["bodies"]:
        count = body_set["count"]
        radius = bounding_radius(body_set["shape"])

        for index in range(count):
            body_id = body_set["id"] if count == 1 else f"{body_set['id']}_{index}"
            placement = body_set["placement"]

            if placement["type"] == "pose":
                position = np.array(placement["pose"]["position"], dtype=float)
                quaternion = euler_xyz_to_quat(placement["pose"]["rotationDeg"])
            else:
                position = _place_in_region(rng, placement, radius, occupied, body_id)
                occupied.append((position, radius))
                quaternion = (
                    random_quaternion(rng)
                    if placement["randomRotation"]
                    else np.array([1.0, 0.0, 0.0, 0.0])
                )

            bodies.append(
                Body(
                    id=body_id,
                    set_id=body_set["id"],
                    label=body_set["label"],
                    shape=body_set["shape"],
                    mass=sample_range(rng, body_set["mass"]),
                    friction=sample_range(rng, body_set["friction"]),
                    position=position,
                    quaternion=quaternion,
                    linear_velocity=np.array(body_set["linearVelocity"], dtype=float),
                    angular_velocity=np.array(body_set["angularVelocity"], dtype=float),
                )
            )

    return bodies


def sample_range(rng: np.random.Generator, value: float | dict) -> float:
    if isinstance(value, dict):
        return float(rng.uniform(value["min"], value["max"]))
    return float(value)


def bounding_radius(shape: dict) -> float:
    match shape["type"]:
        case "box":
            return float(np.linalg.norm(shape["size"]) / 2)
        case "sphere":
            return float(shape["radius"])
        case "cylinder":
            return math.hypot(shape["radius"], shape["length"] / 2)
        case "capsule":
            return float(shape["radius"] + shape["length"] / 2)
    raise SpecError(f"Unknown shape type {shape['type']!r}")


def _place_in_region(
    rng: np.random.Generator,
    region: dict,
    radius: float,
    occupied: list[tuple[np.ndarray, float]],
    body_id: str,
) -> np.ndarray:
    center = np.array(region["center"], dtype=float)
    half = np.array(region["size"], dtype=float) / 2

    for _ in range(MAX_PLACEMENT_ATTEMPTS):
        candidate = center + rng.uniform(-half, half)

        if all(
            np.linalg.norm(candidate - other) >= radius + other_radius
            for other, other_radius in occupied
        ):
            return candidate

    raise SpecError(
        f"Could not place {body_id} without overlap: the spawn region is too "
        "small for the bodies in it. Enlarge the region or reduce the count."
    )


def euler_xyz_to_quat(degrees: list[float]) -> np.ndarray:
    """Intrinsic XYZ Euler angles, in degrees, to a (w, x, y, z) quaternion."""
    quaternion = np.array([1.0, 0.0, 0.0, 0.0])

    for axis, angle in zip(np.eye(3), np.radians(degrees)):
        half = angle / 2
        step = np.concatenate([[math.cos(half)], math.sin(half) * axis])
        # Intrinsic: each rotation is about the already-rotated axes, so it
        # composes on the right.
        quaternion = quat_multiply(quaternion, step)

    return quaternion


def quat_multiply(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return np.array(
        [
            aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
        ]
    )


def random_quaternion(rng: np.random.Generator) -> np.ndarray:
    """Uniformly distributed rotation (Shoemake's method)."""
    u1, u2, u3 = rng.uniform(0, 1, 3)
    return np.array(
        [
            math.sqrt(u1) * math.cos(2 * math.pi * u3),
            math.sqrt(1 - u1) * math.sin(2 * math.pi * u2),
            math.sqrt(1 - u1) * math.cos(2 * math.pi * u2),
            math.sqrt(u1) * math.sin(2 * math.pi * u3),
        ]
    )
