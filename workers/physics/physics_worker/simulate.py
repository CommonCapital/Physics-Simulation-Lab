"""Running one seed of a spec and recording its trajectory.

The trajectory is the single physics source of truth: the browser preview
replays it and the render worker poses its scene from it, so neither ever
runs physics of its own.
"""

import math
from typing import Any

import mujoco
import numpy as np

from .mjcf import build_mjcf
from .sampling import Body, sample_scene
from .spec import Spec, SpecError, validate_spec

# Overlap at t = 0 deeper than this is a spec error, not something to settle.
INITIAL_PENETRATION_LIMIT = 0.005
# A body whose centre sinks this far below the ground has tunnelled through it.
BELOW_GROUND_MARGIN = 0.05
# Below this speed (m/s) a body counts as at rest.
REST_SPEED = 0.01
# Trajectory values are rounded to this many decimals (micrometres) to keep
# the JSON small; far below what a preview or a render can resolve.
DECIMALS = 6


def run(spec: Any, seed: int) -> dict[str, Any]:
    spec = validate_spec(spec)

    if not 0 <= seed < spec["seeds"]:
        raise SpecError(f"Seed {seed} is outside the spec's range 0..{spec['seeds'] - 1}")

    bodies = sample_scene(spec, seed)
    model = mujoco.MjModel.from_xml_string(build_mjcf(spec, bodies))
    data = mujoco.MjData(model)

    mujoco.mj_forward(model, data)
    body_ids = [model.body(body.id).id for body in bodies]
    dof_addresses = [model.jnt_dofadr[model.joint(body.id).id] for body in bodies]
    _set_initial_velocities(data, bodies, body_ids, dof_addresses)
    mujoco.mj_forward(model, data)

    initial_contacts = _contacts(model, data)
    initial_penetration = max(
        (contact["penetration"] for contact in initial_contacts), default=0.0
    )

    if initial_penetration > INITIAL_PENETRATION_LIMIT:
        worst = max(initial_contacts, key=lambda contact: contact["penetration"])
        raise SpecError(
            f"{worst['geoms'][0]} and {worst['geoms'][1]} overlap by "
            f"{worst['penetration'] * 1000:.1f} mm at t = 0. Move them apart."
        )

    duration = spec["simulation"]["duration"]
    capture_interval = 1 / spec["simulation"]["captureHz"]
    half_step = model.opt.timestep / 2
    frame_count = math.floor(duration / capture_interval + 1e-9) + 1

    frames = []
    max_penetration = initial_penetration

    for index in range(frame_count):
        target = index * capture_interval

        while data.time < target - half_step:
            mujoco.mj_step(model, data)

        if not np.all(np.isfinite(data.qpos)):
            raise SpecError(
                f"The simulation became unstable at t = {data.time:.3f} s. "
                "Reduce the timestep or check for extreme masses or velocities."
            )

        contacts = _contacts(model, data)
        max_penetration = max(
            [max_penetration, *(contact["penetration"] for contact in contacts)]
        )
        frames.append(_frame(data, body_ids, dof_addresses, contacts))

    return {
        "seed": seed,
        "timestep": model.opt.timestep,
        "captureHz": spec["simulation"]["captureHz"],
        "bodies": [
            {
                "id": body.id,
                "set": body.set_id,
                "label": body.label,
                "shape": body.shape,
                "mass": round(body.mass, DECIMALS),
                "friction": round(body.friction, DECIMALS),
            }
            for body in bodies
        ],
        "fixtures": spec["fixtures"],
        "frames": frames,
        "stats": _stats(spec, bodies, frames, initial_penetration, max_penetration),
    }


def _set_initial_velocities(data, bodies: list[Body], body_ids, dof_addresses) -> None:
    for body, body_id, dof in zip(bodies, body_ids, dof_addresses):
        rotation = data.xmat[body_id].reshape(3, 3)
        data.qvel[dof : dof + 3] = body.linear_velocity
        # A free joint's angular velocity is in the body's own frame.
        data.qvel[dof + 3 : dof + 6] = rotation.T @ body.angular_velocity


def _frame(data, body_ids, dof_addresses, contacts) -> dict[str, Any]:
    poses = []
    velocities = []

    for body_id, dof in zip(body_ids, dof_addresses):
        rotation = data.xmat[body_id].reshape(3, 3)
        poses.append(_round([*data.xpos[body_id], *data.xquat[body_id]]))
        velocities.append(
            _round([*data.qvel[dof : dof + 3], *(rotation @ data.qvel[dof + 3 : dof + 6])])
        )

    return {
        "t": round(float(data.time), DECIMALS),
        # Per body, in `bodies` order: x, y, z, qw, qx, qy, qz.
        "poses": poses,
        # Per body, world frame: vx, vy, vz, wx, wy, wz.
        "velocities": velocities,
        "energy": {
            "potential": round(float(data.energy[0]), DECIMALS),
            "kinetic": round(float(data.energy[1]), DECIMALS),
        },
        "contacts": [
            {
                "geoms": contact["geoms"],
                "position": _round(contact["position"]),
                "normalForce": round(contact["normalForce"], DECIMALS),
            }
            for contact in contacts
        ],
    }


def _contacts(model, data) -> list[dict[str, Any]]:
    contacts = []
    force = np.zeros(6)

    for index in range(data.ncon):
        contact = data.contact[index]
        mujoco.mj_contactForce(model, data, index, force)
        contacts.append(
            {
                "geoms": [model.geom(contact.geom1).name, model.geom(contact.geom2).name],
                "position": contact.pos.copy(),
                # Negative distance is overlap.
                "penetration": max(0.0, -float(contact.dist)),
                # mj_contactForce reports in the contact frame, normal first.
                "normalForce": float(force[0]),
            }
        )

    return contacts


def _stats(spec, bodies, frames, initial_penetration, max_penetration) -> dict[str, Any]:
    last = frames[-1]
    speeds = [float(np.linalg.norm(velocity[:3])) for velocity in last["velocities"]]
    below_ground = []

    if spec["ground"] is not None:
        below_ground = [
            body.id
            for body, pose in zip(bodies, last["poses"])
            if pose[2] < -BELOW_GROUND_MARGIN
        ]

    first_energy = frames[0]["energy"]
    last_energy = last["energy"]

    return {
        "frames": len(frames),
        "initialPenetration": round(initial_penetration, DECIMALS),
        "maxPenetration": round(max_penetration, DECIMALS),
        "finalMaxSpeed": round(max(speeds), DECIMALS),
        "settled": max(speeds) < REST_SPEED,
        "belowGround": below_ground,
        "energyStart": round(first_energy["potential"] + first_energy["kinetic"], DECIMALS),
        "energyEnd": round(last_energy["potential"] + last_energy["kinetic"], DECIMALS),
    }


def _round(values) -> list[float]:
    return [round(float(value), DECIMALS) for value in values]
