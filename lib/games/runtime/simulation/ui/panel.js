/**
 * The report panel: what a simulation claims, and how far the claim goes.
 *
 * A number on screen with nothing around it is the failure mode this exists
 * to prevent. A deflection of 4.2 mm means one thing if it came from a
 * textbook formula under stated assumptions and something else entirely if it
 * came from a visual approximation tuned to look right — and a reader cannot
 * tell the two apart from the number. So the panel puts a mode badge beside
 * the title, and gives assumptions, limitations and verification status
 * sections of their own rather than a footnote.
 *
 * It is a separate surface from the engine HUD on purpose. The HUD is for the
 * thing being simulated; this is for the claim being made about it. Mixing
 * them would put a score and a bending moment in the same box.
 */

import { createComparisonTable } from "./comparison.js"
import { createNumericField } from "./controls.js"
import { createPlot } from "./plot.js"
import { element } from "./dom.js"
import { ensureSimulationStyles } from "./styles.js"
import { formatQuantity } from "./format.js"

/**
 * What kind of claim the numbers are.
 *
 * `note` is shown under the badge and is not optional prose: it is the
 * sentence that stops a conceptual visualisation from being read as an
 * engineering result.
 */
export const SIMULATION_MODES = Object.freeze({
  educational: Object.freeze({
    id: "educational",
    label: "Educational",
    note: "Teaching model. Correct within its stated assumptions; not intended for design decisions.",
  }),
  "preliminary-engineering": Object.freeze({
    id: "preliminary-engineering",
    label: "Preliminary engineering",
    note: "Preliminary estimate only. Not a substitute for design calculations, code checks, or professional review.",
  }),
  "conceptual-visualization": Object.freeze({
    id: "conceptual-visualization",
    label: "Conceptual visualization",
    note: "Illustrative only. Values are not quantitatively reliable and must not be used for any decision.",
  }),
})

/** The fixed running order of the report. */
const SECTION_ORDER = Object.freeze([
  "inputs",
  "assumptions",
  "physical-model",
  "numerical-method",
  "results",
  "comparison",
  "limitations",
  "verification",
  "next-steps",
])

const SECTION_TITLES = Object.freeze({
  inputs: "Inputs",
  assumptions: "Assumptions",
  "physical-model": "Physical model",
  "numerical-method": "Numerical method",
  results: "Primary results",
  comparison: "Scenario comparison",
  limitations: "Limitations",
  verification: "Verification status",
  "next-steps": "Recommended next steps",
})

/** Verification claims, weakest first. The wording is deliberately cautious:
    "verified" here means checked against something, never "correct". */
export const VERIFICATION_STATUSES = Object.freeze({
  unverified: Object.freeze({
    id: "unverified",
    label: "Unverified",
    severity: "unverified",
  }),
  "partially-verified": Object.freeze({
    id: "partially-verified",
    label: "Partially verified",
    severity: "partially-verified",
  }),
  verified: Object.freeze({
    id: "verified",
    label: "Verified against a reference",
    severity: "verified",
  }),
})

function resolveMode(mode) {
  if (typeof mode === "string") {
    const resolved = SIMULATION_MODES[mode]
    if (!resolved) {
      throw new RangeError(
        `unknown simulation mode ${mode}; expected one of ${Object.keys(SIMULATION_MODES).join(", ")}`
      )
    }
    return resolved
  }

  if (mode === null || typeof mode !== "object" || !mode.label) {
    throw new TypeError("mode must be a known id or an object with a label")
  }
  return mode
}

export function createSimulationPanel(options = {}) {
  const {
    container = document.body,
    title = "Simulation",
    mode = "educational",
    label = "Simulation report",
  } = options

  ensureSimulationStyles()

  const root = element("section", "sim-panel")
  // A named landmark, so the report is one tab stop away in a screen
  // reader's rotor rather than something to be found by scrolling.
  root.setAttribute("aria-label", label)

  const header = element("div", "sim-header")
  const titleNode = element("h2", "sim-title", title)
  const badge = element("span", "sim-badge")
  const badgeNote = element("p", "sim-badge-note")
  header.append(titleNode, badge, badgeNote)
  root.append(header)
  container.append(root)

  const sections = new Map()

  function applyMode(next) {
    const resolved = resolveMode(next)
    badge.textContent = resolved.label
    badge.dataset.mode = resolved.id ?? "custom"
    badgeNote.textContent = resolved.note ?? ""
  }

  applyMode(mode)

  /**
   * A section, created on demand and inserted in the fixed running order.
   *
   * Order is not the order sections are asked for: a caller that fills in
   * results before it has written down its assumptions should still produce a
   * report that reads top to bottom the same way every time.
   */
  function section(id, titleText) {
    const existing = sections.get(id)
    if (existing) return existing

    const node = element("section", "sim-section")
    node.dataset.section = id
    const heading = element(
      "h3",
      "sim-section-title",
      titleText ?? SECTION_TITLES[id] ?? id
    )
    const body = element("div", "sim-section-body")
    node.append(heading, body)

    const rank = SECTION_ORDER.indexOf(id)
    const effectiveRank = rank === -1 ? SECTION_ORDER.length : rank

    // Walked in document order rather than creation order: the new section
    // goes before the first one already on screen that outranks it, and a
    // caller that filled the report out of order still gets it back in order.
    // Sections with no place in the running order collect at the end.
    const successor = [...root.children].find((candidate) => {
      const existing = sections.get(candidate.dataset?.section)
      return existing !== undefined && existing.rank > effectiveRank
    })
    if (successor) root.insertBefore(node, successor)
    else root.append(node)

    const handle = {
      id,
      node,
      body,
      rank: effectiveRank,
      setText(text) {
        body.replaceChildren(element("p", null, text))
        return handle
      },
      setList(items) {
        const list = element("ul")
        for (const item of items) list.append(element("li", null, item))
        body.replaceChildren(list)
        return handle
      },
      /** `[{ label, value, unit }]` as a description list — the shape inputs
          and results both take, so units always sit beside their number. */
      setQuantities(entries) {
        const list = element("dl", "sim-definitions")
        for (const entry of entries) {
          list.append(
            element("dt", null, entry.label),
            element(
              "dd",
              null,
              entry.text ?? formatQuantity(entry.value, entry.unit, entry)
            )
          )
        }
        body.replaceChildren(list)
        return handle
      },
      append(...nodes) {
        body.append(...nodes)
        return handle
      },
      clear() {
        body.replaceChildren()
        return handle
      },
      remove() {
        node.remove()
        sections.delete(id)
      },
    }

    sections.set(id, handle)
    return handle
  }

  const panel = {
    root,
    section,
    setTitle(next) {
      titleNode.textContent = next
    },
    setMode: applyMode,

    inputs: (entries) => section("inputs").setQuantities(entries),
    assumptions: (items) => section("assumptions").setList(items),
    physicalModel: (text) => section("physical-model").setText(text),
    numericalMethod: (text) => section("numerical-method").setText(text),
    results: (entries) => section("results").setQuantities(entries),
    limitations: (items) => section("limitations").setList(items),
    nextSteps: (items) => section("next-steps").setList(items),

    /**
     * What the result has been checked against, and what it has not.
     *
     * `evidence` is a list rather than a sentence because it is the part a
     * reviewer reads first: which case, against which reference, to what
     * error.
     */
    verification({ status = "unverified", detail, evidence = [] } = {}) {
      const resolved =
        typeof status === "string"
          ? (VERIFICATION_STATUSES[status] ?? {
              id: status,
              label: status,
              severity: "unverified",
            })
          : status

      const target = section("verification").clear()
      const line = element("p")
      const badgeNode = element("span", "sim-status", resolved.label)
      badgeNode.dataset.status = resolved.severity ?? resolved.id
      line.append(badgeNode)
      target.append(line)
      if (detail) target.append(element("p", null, detail))
      if (evidence.length) {
        const list = element("ul")
        for (const item of evidence) list.append(element("li", null, item))
        target.append(list)
      }
      return target
    },

    /** A numeric control, filed under Inputs unless told otherwise. */
    numericField(fieldOptions = {}) {
      const { at = "inputs", ...rest } = fieldOptions
      const field = createNumericField(rest)
      section(at).append(field.root)
      return field
    },

    /** A plot, filed under Primary results unless told otherwise. */
    plot(plotOptions = {}) {
      const { at = "results", ...rest } = plotOptions
      const chart = createPlot(rest)
      section(at).append(chart.root)
      return chart
    },

    /** A baseline/modified table, in its own section by default. */
    comparison(comparisonOptions = {}) {
      const { at = "comparison", ...rest } = comparisonOptions
      const target = section(at).clear()
      const table = createComparisonTable(rest)
      target.append(table.root)
      return table
    },

    /** Collapse the panel out of the way without losing its contents. */
    setVisible(visible) {
      root.hidden = !visible
    },

    clear() {
      for (const handle of [...sections.values()]) handle.remove()
    },

    remove: () => root.remove(),
  }

  return panel
}
