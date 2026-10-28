"""Loading and checking scene specs.

The contract is `scene_spec.schema.json`, exported from `lib/scene-spec/schema.ts`
(`npm run spec:schema`). Specs arrive already parsed by that zod schema, so
every default is filled in and this module only has to reject what does not
match.
"""

import json
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "scene_spec.schema.json"

Spec = dict[str, Any]


class SpecError(ValueError):
    """A spec that does not match the schema, or cannot be built as given."""


@cache
def _validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(SCHEMA_PATH.read_text()))


def validate_spec(spec: Any) -> Spec:
    errors = sorted(_validator().iter_errors(spec), key=lambda error: error.path)

    if errors:
        lines = [
            f"{'/'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
            for error in errors
        ]
        raise SpecError("Invalid scene spec:\n" + "\n".join(lines))

    return spec
