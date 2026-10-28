"""Command line: run one seed of a spec and write its trajectory as JSON.

    python -m physics_worker SPEC.json --seed 0 [--out TRAJECTORY.json]

Reads the spec from stdin when SPEC is "-", and writes to stdout without
--out. Exits 2 with the reason on stderr when the spec is invalid or cannot
be simulated as given.
"""

import argparse
import json
import sys

from .simulate import run
from .spec import SpecError


def main() -> int:
    parser = argparse.ArgumentParser(prog="physics_worker")
    parser.add_argument("spec", help='path to a scene spec, or "-" for stdin')
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", help="write the trajectory here instead of stdout")
    args = parser.parse_args()

    if args.spec == "-":
        spec = json.load(sys.stdin)
    else:
        with open(args.spec) as file:
            spec = json.load(file)

    try:
        trajectory = run(spec, args.seed)
    except SpecError as error:
        print(error, file=sys.stderr)
        return 2

    output = json.dumps(trajectory, separators=(",", ":"))

    if args.out:
        with open(args.out, "w") as file:
            file.write(output)
    else:
        sys.stdout.write(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
