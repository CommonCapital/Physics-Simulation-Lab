/**
 * Baseline versus modified, rendered as a table.
 *
 * The numbers come from `compare.js`; this file only decides how they read.
 * The one thing it must not do is fill in a percentage where there is none:
 * where the comparison says a relative change is undefined the cell carries
 * the reason instead, as text, so the gap is an answer rather than an
 * oversight.
 */

import { compareScenarios } from "./compare.js"
import { formatPercent, formatQuantity } from "./format.js"
import { element } from "./dom.js"

export function createComparisonTable(options = {}) {
  const {
    caption = "Scenario comparison",
    baselineLabel = "Baseline",
    modifiedLabel = "Modified",
  } = options

  const root = element("div", "sim-section")
  const api = { root, render }

  function render(nextOptions = {}) {
    const rows =
      nextOptions.rows ??
      compareScenarios({
        fields: nextOptions.fields ?? options.fields ?? [],
        baseline: nextOptions.baseline ?? options.baseline ?? {},
        modified: nextOptions.modified ?? options.modified ?? {},
      })

    root.replaceChildren()

    const table = element("table", "sim-table")
    table.append(element("caption", null, nextOptions.caption ?? caption))

    const head = document.createElement("thead")
    const headRow = document.createElement("tr")
    for (const heading of [
      "Quantity",
      nextOptions.baselineLabel ?? baselineLabel,
      nextOptions.modifiedLabel ?? modifiedLabel,
      "Δ",
      "Δ %",
    ]) {
      const cell = element("th", null, heading)
      cell.setAttribute("scope", "col")
      headRow.append(cell)
    }
    head.append(headRow)

    const body = document.createElement("tbody")
    for (const row of rows) {
      const tr = document.createElement("tr")
      const label = element("th", null, row.label || row.field)
      label.setAttribute("scope", "row")
      tr.append(
        label,
        element("td", null, formatQuantity(row.baseline, row.unit)),
        element("td", null, formatQuantity(row.modified, row.unit)),
        // Signed, because "which way" is the first thing a reader wants and
        // a bare magnitude makes them go back and subtract.
        element(
          "td",
          null,
          formatQuantity(row.absoluteDifference, row.unit, { signed: true })
        )
      )

      const percentCell = element("td")
      if (row.percentDifference === null) {
        percentCell.dataset.unavailable = "true"
        percentCell.textContent = "not defined"
        // The dash on its own reads as "nobody filled this in". The title and
        // the visually hidden note say which of the two it actually is.
        percentCell.title = row.percentUnavailableReason ?? ""
        const note = element(
          "span",
          "sim-sr-only",
          `: ${row.percentUnavailableReason ?? "unavailable"}`
        )
        percentCell.append(note)
      } else {
        percentCell.textContent = formatPercent(row.percentDifference, {
          signed: true,
        })
      }
      tr.append(percentCell)
      body.append(tr)
    }

    table.append(head, body)
    root.append(table)
    return api
  }

  return render(options)
}
