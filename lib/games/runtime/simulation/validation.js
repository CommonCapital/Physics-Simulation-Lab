export function requireField(record, field) {
  if (record === null || typeof record !== "object" || !(field in record)) {
    throw new TypeError(`${field} is required`)
  }

  const value = record[field]
  if (value === undefined || value === null || value === "") {
    throw new TypeError(`${field} is required`)
  }

  return value
}

export function assertFiniteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`)
  }

  return value
}

export function assertPositive(value, field) {
  assertFiniteNumber(value, field)
  if (value <= 0) {
    throw new RangeError(`${field} must be positive`)
  }

  return value
}

export function assertNonNegative(value, field) {
  assertFiniteNumber(value, field)
  if (value < 0) {
    throw new RangeError(`${field} must be non-negative`)
  }

  return value
}

export function assertInRange(value, minimum, maximum, field) {
  assertFiniteNumber(value, field)
  assertFiniteNumber(minimum, `${field} minimum`)
  assertFiniteNumber(maximum, `${field} maximum`)

  if (minimum > maximum) {
    throw new RangeError(`${field} minimum must not exceed ${field} maximum`)
  }
  if (value < minimum || value > maximum) {
    throw new RangeError(
      `${field} must be between ${minimum} and ${maximum}, inclusive`,
    )
  }

  return value
}
