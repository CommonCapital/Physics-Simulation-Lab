/**
 * The arithmetic behind a plot, separated from the drawing of it.
 *
 * A line chart is an assertion: it says the quantity moved smoothly from this
 * point to the next one. Where a sample is missing or non-finite that
 * assertion is false, and a polyline drawn straight across the gap invents
 * data the solver never produced — which is exactly the kind of mistake a
 * preliminary engineering result must not make. So a series is split into
 * runs of consecutive valid points, and the renderer draws one line per run
 * with nothing bridging the gaps.
 *
 * Nothing here touches the DOM.
 */

import { formatQuantity, isFiniteNumber } from "./format.js"

export function isValidPoint(point) {
  return (
    point !== null &&
    typeof point === "object" &&
    isFiniteNumber(point.x) &&
    isFiniteNumber(point.y)
  )
}

/**
 * `[valid, valid, invalid, valid]` -> `[[valid, valid], [valid]]`.
 *
 * A run of one point survives on purpose: it has no line to draw but it is a
 * real measurement, and the renderer marks it so it is not lost.
 */
export function splitIntoSegments(points) {
  if (!Array.isArray(points)) {
    throw new TypeError("points must be an array")
  }

  const segments = []
  let current = null
  for (const point of points) {
    if (isValidPoint(point)) {
      if (current === null) {
        current = []
        segments.push(current)
      }
      current.push({ x: point.x, y: point.y })
    } else {
      current = null
    }
  }

  return segments
}

/** How many of a series' points could not be plotted. */
export function countInvalidPoints(points) {
  if (!Array.isArray(points)) {
    throw new TypeError("points must be an array")
  }
  return points.reduce(
    (total, point) => total + (isValidPoint(point) ? 0 : 1),
    0
  )
}

/**
 * The data-space box every series fits inside, or null when nothing is
 * plottable. A degenerate axis — every sample at the same value — is padded,
 * because a zero-width range divides by zero when points are scaled and puts
 * a flat line either off-canvas or nowhere at all.
 */
export function computeSeriesBounds(series) {
  if (!Array.isArray(series)) {
    throw new TypeError("series must be an array")
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let count = 0

  for (const entry of series) {
    for (const point of entry?.points ?? []) {
      if (!isValidPoint(point)) continue
      count += 1
      if (point.x < minX) minX = point.x
      if (point.x > maxX) maxX = point.x
      if (point.y < minY) minY = point.y
      if (point.y > maxY) maxY = point.y
    }
  }

  if (count === 0) return null

  const padAxis = (low, high) => {
    if (low !== high) return [low, high]
    const pad = Math.abs(low) > 0 ? Math.abs(low) * 0.05 : 0.5
    return [low - pad, high + pad]
  }

  const [paddedMinX, paddedMaxX] = padAxis(minX, maxX)
  const [paddedMinY, paddedMaxY] = padAxis(minY, maxY)

  return {
    minX: paddedMinX,
    maxX: paddedMaxX,
    minY: paddedMinY,
    maxY: paddedMaxY,
    pointCount: count,
  }
}

/**
 * The plot in words.
 *
 * This is the text alternative a screen reader gets, and the fallback anyone
 * reads when the chart is a picture in a copied-out report. It says the shape
 * of each series — where it starts, where it ends, how far it ranges — and it
 * always says how many points were dropped, because a chart that silently
 * omits a third of its data is the one worth knowing about.
 */
export function describeSeries(series, axes = {}) {
  if (!Array.isArray(series)) {
    throw new TypeError("series must be an array")
  }

  const { x = {}, y = {} } = axes
  const xLabel = x.label ?? "x"
  const yLabel = y.label ?? "y"

  if (series.length === 0) return "No series to plot."

  const sentences = series.map((entry) => {
    const name = entry?.label ?? "Unnamed series"
    const points = entry?.points ?? []
    const valid = points.filter(isValidPoint)
    const invalid = points.length - valid.length
    const omitted =
      invalid > 0
        ? ` ${invalid} of ${points.length} point${points.length === 1 ? "" : "s"} omitted as invalid.`
        : ""

    if (valid.length === 0) {
      return `${name}: no plottable points.${omitted}`
    }

    const first = valid[0]
    const last = valid[valid.length - 1]
    const values = valid.map((point) => point.y)
    const lowest = Math.min(...values)
    const highest = Math.max(...values)

    return (
      `${name}: ${valid.length} point${valid.length === 1 ? "" : "s"} ` +
      `from ${xLabel} ${formatQuantity(first.x, x.unit)} to ${formatQuantity(last.x, x.unit)}; ` +
      `${yLabel} starts at ${formatQuantity(first.y, y.unit)}, ends at ${formatQuantity(last.y, y.unit)}, ` +
      `ranging from ${formatQuantity(lowest, y.unit)} to ${formatQuantity(highest, y.unit)}.${omitted}`
    )
  })

  return sentences.join(" ")
}
