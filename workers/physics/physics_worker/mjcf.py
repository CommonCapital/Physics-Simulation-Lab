"""Compiling a sampled scene to MuJoCo's MJCF.

This is the only module that knows about MuJoCo's model format; another
engine would get its own compiler next to it, fed the same `Body` list.
"""

from xml.etree import ElementTree as ET

from .sampling import Body
from .spec import Spec

# MuJoCo friction is (sliding, torsional, rolling). The spec only has the
# Coulomb sliding coefficient; these keep spinning and rolling lightly damped
# so resting bodies come to rest instead of spinning or rolling forever.
TORSIONAL_FRICTION = 0.005
ROLLING_FRICTION = 0.0001

# Contact softness, as MuJoCo's solref time constant (s). The default, 0.02,
# lets boxes dropped from a metre or two sink 5 cm into each other on impact;
# 0.005 keeps that near 1 cm and resting overlap under 0.1 mm. MuJoCo raises
# it to twice the timestep on its own when the timestep is coarser.
CONTACT_TIME_CONSTANT = 0.005


def build_mjcf(spec: Spec, bodies: list[Body]) -> str:
    root = ET.Element("mujoco", model="scene")
    # Degrees and intrinsic xyz, to match the spec's `rotationDeg`.
    ET.SubElement(root, "compiler", angle="degree", eulerseq="xyz")

    option = ET.SubElement(
        root,
        "option",
        timestep=_num(spec["simulation"]["timestep"]),
        gravity=_vec(spec["gravity"]),
        integrator="implicitfast",
        # Elliptic cones with a high impratio keep static friction from
        # creeping, which the default pyramidal cone visibly does on a slope.
        cone="elliptic",
        impratio="10",
    )
    ET.SubElement(option, "flag", energy="enable")

    default = ET.SubElement(root, "default")
    ET.SubElement(default, "geom", solref=_vec([CONTACT_TIME_CONSTANT, 1]))

    world = ET.SubElement(root, "worldbody")

    if spec["ground"] is not None:
        ET.SubElement(
            world,
            "geom",
            name="ground",
            type="plane",
            size="0 0 1",
            friction=_friction(spec["ground"]["friction"]),
        )

    for fixture in spec["fixtures"]:
        ET.SubElement(
            world,
            "geom",
            name=fixture["id"],
            pos=_vec(fixture["pose"]["position"]),
            euler=_vec(fixture["pose"]["rotationDeg"]),
            friction=_friction(fixture["friction"]),
            **_shape(fixture["shape"]),
        )

    for body in bodies:
        element = ET.SubElement(
            world,
            "body",
            name=body.id,
            pos=_vec(body.position),
            quat=_vec(body.quaternion),
        )
        ET.SubElement(element, "freejoint", name=body.id)
        ET.SubElement(
            element,
            "geom",
            name=body.id,
            mass=_num(body.mass),
            friction=_friction(body.friction),
            **_shape(body.shape),
        )

    return ET.tostring(root, encoding="unicode")


def _shape(shape: dict) -> dict[str, str]:
    # MuJoCo sizes are half-extents; the spec's are full lengths.
    match shape["type"]:
        case "box":
            return {"type": "box", "size": _vec([edge / 2 for edge in shape["size"]])}
        case "sphere":
            return {"type": "sphere", "size": _num(shape["radius"])}
        case "cylinder" | "capsule":
            return {
                "type": shape["type"],
                "size": _vec([shape["radius"], shape["length"] / 2]),
            }
    raise ValueError(f"Unknown shape type {shape['type']!r}")


def _friction(sliding: float) -> str:
    return _vec([sliding, TORSIONAL_FRICTION, ROLLING_FRICTION])


def _vec(values) -> str:
    return " ".join(_num(value) for value in values)


def _num(value: float) -> str:
    return repr(float(value))
