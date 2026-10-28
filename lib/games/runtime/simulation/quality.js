import { assertFiniteNumber, assertPositive } from "./validation.js"

export function absoluteError(approximate, reference) {
  assertFiniteNumber(approximate, "approximate")
  assertFiniteNumber(reference, "reference")
  return Math.abs(approximate - reference)
}

export function relativeError(approximate, reference) {
  assertFiniteNumber(approximate, "approximate")
  assertFiniteNumber(reference, "reference")
  if (reference === 0) {
    throw new RangeError("reference must be non-zero for relative error")
  }

  return absoluteError(approximate, reference) / Math.abs(reference)
}

export function conservationDrift(currentValue, initialValue) {
  assertFiniteNumber(currentValue, "currentValue")
  assertFiniteNumber(initialValue, "initialValue")
  if (initialValue === 0) {
    throw new RangeError("initialValue must be non-zero for conservation drift")
  }

  return Math.abs(currentValue - initialValue) / Math.abs(initialValue)
}

export function compareTimeStepConvergence({
  coarseValue,
  fineValue,
  referenceValue,
  refinementRatio = 2,
}) {
  assertPositive(refinementRatio, "refinementRatio")
  if (refinementRatio <= 1) {
    throw new RangeError("refinementRatio must be greater than 1")
  }

  const coarseError = absoluteError(coarseValue, referenceValue)
  const fineError = absoluteError(fineValue, referenceValue)
  const errorReductionFactor =
    fineError === 0 ? Number.POSITIVE_INFINITY : coarseError / fineError
  const observedOrder =
    coarseError === 0 || fineError === 0
      ? null
      : Math.log(errorReductionFactor) / Math.log(refinementRatio)

  return {
    coarseError,
    fineError,
    errorReductionFactor,
    observedOrder,
    converges: fineError < coarseError,
  }
}
