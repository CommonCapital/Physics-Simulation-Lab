/**
 * A line plot, drawn as inline SVG.
 *
 * SVG rather than canvas because the plot is part of a report: it scales with
 * the panel, stays sharp when someone zooms, and — the reason that matters
 * most here — its parts are real nodes, so the chart can carry an accessible
 * name and sit beside a real table of the numbers it drew.
 *
 * Three states are drawn, not two. A plot with no data says so; a plot whose
 * every sample is non-finite says *that*, which is a different and more
 * alarming thing; and a plot with some invalid samples draws the valid runs
 * as separate lines and prints how many points it left out. Nothing is ever
 * interpolated across a gap.
 */

import { formatQuantity } from "./format.js"
import { element, svgElement, uniqueId } from "./dom.js"
import {
  computeSeriesBounds,
  countInvalidPoints,
  describeSeries,
  splitIntoSegments,
} from "./series.js"

/**
 * Series colours, in the order they are handed out.
 *
 * Chosen to stay apart for the common forms of colour blindness and to hold
 * at least 4.5:1 against the panel's dark ground — and the legend names every
 * series in text as well, so colour is never the only thing carrying which
 * line is which.
 */
const SERIES_COLORS = Object.freeze([
  "#fb923c",
  "#7dd3fc",
  "#86efac",
  "#d8b4fe",
  "#fde047",
])

const MAX_TABLE_ROWS = 200

const VIEW_WIDTH = 480
const VIEW_HEIGHT = 300
const MARGIN = Object.freeze({ top: 12, right: 14, bottom: 46, left: 62 })

function axisTitle(axis) {
  const label = axis?.label ?? ""
  return axis?.unit ? `${label} (${axis.unit})` : label
}

/** A handful of round-ish tick values across a range. */
function ticksFor(low, high, count = 4) {
  return Array.from(
    { length: count + 1 },
    (_, index) => low + ((high - low) * index) / count
  )
}

export function createPlot(options = {}) {
  const {
    title,
    axes = {},
    series = [],
    emptyMessage = "No data to plot yet.",
    showTable = true,
  } = options

  const root = element("div", "sim-plot")
  const titleId = uniqueId("sim-plot-title")
  const api = { root, render }

  function render(nextOptions = {}) {
    const nextSeries = nextOptions.series ?? series
    const nextAxes = nextOptions.axes ?? axes
    const nextTitle = nextOptions.title ?? title
    root.replaceChildren()

    if (nextTitle) {
      const heading = element("h4", "sim-section-title", nextTitle)
      heading.id = titleId
      root.append(heading)
    }

    const bounds = computeSeriesBounds(nextSeries)
    const totalPoints = nextSeries.reduce(
      (total, entry) => total + (entry?.points?.length ?? 0),
      0
    )
    const invalidCount = nextSeries.reduce(
      (total, entry) => total + countInvalidPoints(entry?.points ?? []),
      0
    )

    if (bounds === null) {
      // Two different failures, and the distinction is the whole point: an
      // empty run has not happened yet, while a run that produced only
      // non-finite numbers has happened and gone wrong.
      root.append(
        element(
          "p",
          "sim-plot-empty",
          totalPoints === 0
            ? emptyMessage
            : `No plottable data: all ${totalPoints} sample${totalPoints === 1 ? "" : "s"} are invalid or non-finite.`
        )
      )
      return api
    }

    const description = describeSeries(nextSeries, nextAxes)
    const svg = svgElement("svg", {
      viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
      role: "img",
      "aria-label": `${nextTitle ? `${nextTitle}. ` : ""}${description}`,
      preserveAspectRatio: "xMidYMid meet",
    })

    const plotWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right
    const plotHeight = VIEW_HEIGHT - MARGIN.top - MARGIN.bottom
    const scaleX = (x) =>
      MARGIN.left +
      ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * plotWidth
    const scaleY = (y) =>
      MARGIN.top +
      plotHeight -
      ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * plotHeight

    for (const value of ticksFor(bounds.minY, bounds.maxY)) {
      const y = scaleY(value)
      svg.append(
        svgElement("line", {
          class: "sim-plot-grid",
          x1: MARGIN.left,
          x2: MARGIN.left + plotWidth,
          y1: y,
          y2: y,
        })
      )
      const label = svgElement("text", {
        class: "sim-plot-tick",
        x: MARGIN.left - 6,
        y: y + 3,
        "text-anchor": "end",
      })
      label.textContent = formatQuantity(value, "", { significantDigits: 3 })
      svg.append(label)
    }

    for (const value of ticksFor(bounds.minX, bounds.maxX)) {
      const x = scaleX(value)
      const label = svgElement("text", {
        class: "sim-plot-tick",
        x,
        y: MARGIN.top + plotHeight + 14,
        "text-anchor": "middle",
      })
      label.textContent = formatQuantity(value, "", { significantDigits: 3 })
      svg.append(label)
    }

    svg.append(
      svgElement("line", {
        class: "sim-plot-axis",
        x1: MARGIN.left,
        x2: MARGIN.left,
        y1: MARGIN.top,
        y2: MARGIN.top + plotHeight,
      }),
      svgElement("line", {
        class: "sim-plot-axis",
        x1: MARGIN.left,
        x2: MARGIN.left + plotWidth,
        y1: MARGIN.top + plotHeight,
        y2: MARGIN.top + plotHeight,
      })
    )

    const xTitle = svgElement("text", {
      class: "sim-plot-axis-label",
      x: MARGIN.left + plotWidth / 2,
      y: VIEW_HEIGHT - 10,
      "text-anchor": "middle",
    })
    xTitle.textContent = axisTitle(nextAxes.x)
    const yTitle = svgElement("text", {
      class: "sim-plot-axis-label",
      // Rotated about its own anchor so the label reads bottom-to-top beside
      // the axis, which is where a reader looks for it.
      transform: `rotate(-90 12 ${MARGIN.top + plotHeight / 2})`,
      x: 12,
      y: MARGIN.top + plotHeight / 2,
      "text-anchor": "middle",
    })
    yTitle.textContent = axisTitle(nextAxes.y)
    svg.append(xTitle, yTitle)

    nextSeries.forEach((entry, index) => {
      const color = entry?.color ?? SERIES_COLORS[index % SERIES_COLORS.length]
      for (const segment of splitIntoSegments(entry?.points ?? [])) {
        if (segment.length === 1) {
          // A lone valid sample between two invalid ones has no line to be
          // part of. Dropping it would hide a real result, so it is a dot.
          svg.append(
            svgElement("circle", {
              class: "sim-plot-dot",
              cx: scaleX(segment[0].x),
              cy: scaleY(segment[0].y),
              r: 2.5,
              fill: color,
            })
          )
          continue
        }

        svg.append(
          svgElement("polyline", {
            class: "sim-plot-line",
            stroke: color,
            points: segment
              .map((point) => `${scaleX(point.x)},${scaleY(point.y)}`)
              .join(" "),
          })
        )
      }
    })

    root.append(svg)

    const legend = element("ul", "sim-legend")
    nextSeries.forEach((entry, index) => {
      const color = entry?.color ?? SERIES_COLORS[index % SERIES_COLORS.length]
      const item = document.createElement("li")
      const swatch = element("span", "sim-legend-swatch")
      swatch.style.backgroundColor = color
      swatch.setAttribute("aria-hidden", "true")
      item.append(
        swatch,
        document.createTextNode(entry?.label ?? `Series ${index + 1}`)
      )
      legend.append(item)
    })
    root.append(legend)

    if (invalidCount > 0) {
      root.append(
        element(
          "p",
          "sim-plot-note",
          `${invalidCount} of ${totalPoints} samples were invalid and are not drawn; lines break at those points rather than crossing them.`
        )
      )
    }

    if (showTable) root.append(buildDataTable(nextSeries, nextAxes))

    return api
  }

  return render({ series, axes, title })
}

/**
 * The same numbers as a table, collapsed behind a disclosure.
 *
 * This is the text alternative for the plotted result. A summary sentence
 * reaches a screen reader through the SVG's accessible name, but a sentence
 * cannot be read off a value at a time — the table can, and being real markup
 * it is also what someone copies into a report.
 */
function buildDataTable(series, axes) {
  const details = element("details", "sim-plot-data")
  details.append(element("summary", null, "Plotted values"))

  const table = element("table", "sim-table")
  table.append(element("caption", null, describeSeries(series, axes)))

  const head = document.createElement("thead")
  const headRow = document.createElement("tr")
  headRow.append(element("th", null, axisTitle(axes.x) || "x"))
  for (const entry of series) {
    headRow.append(
      element(
        "th",
        null,
        `${entry?.label ?? "Series"}${axes.y?.unit ? ` (${axes.y.unit})` : ""}`
      )
    )
  }
  for (const cell of headRow.children) cell.setAttribute("scope", "col")
  head.append(headRow)

  // Rows are keyed on the x values of the first series, which is what a
  // shared-axis plot means. A series sampled somewhere else shows a blank
  // there rather than a number lined up against the wrong abscissa.
  const reference = series[0]?.points ?? []
  // A trajectory can carry tens of thousands of samples. Rendering all of
  // them costs more than anyone will read, so the table shows an evenly
  // spaced subset and says that it did.
  const stride = Math.max(1, Math.ceil(reference.length / MAX_TABLE_ROWS))
  const body = document.createElement("tbody")
  for (const [index, point] of reference.entries()) {
    if (index % stride !== 0 && index !== reference.length - 1) continue
    const row = document.createElement("tr")
    const header = element("th", null, formatQuantity(point?.x, axes.x?.unit))
    header.setAttribute("scope", "row")
    row.append(header)
    for (const entry of series) {
      const value = entry?.points?.[index]
      const cell = element("td", null, formatQuantity(value?.y, axes.y?.unit))
      if (!Number.isFinite(value?.y)) cell.dataset.unavailable = "true"
      row.append(cell)
    }
    body.append(row)
  }

  table.append(head, body)
  details.append(table)
  if (stride > 1) {
    details.append(
      element(
        "p",
        "sim-field-hint",
        `Showing every ${stride}th of ${reference.length} samples.`
      )
    )
  }
  return details
}
