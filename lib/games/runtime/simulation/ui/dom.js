/**
 * The two DOM chores every component here repeats.
 *
 * Everything is built with `createElement` and `textContent` rather than
 * `innerHTML`: a simulation label can carry a unit like `m^4`, a model name
 * can carry an ampersand, and results may come from something a person typed.
 * Setting text as text means none of that can become markup.
 */

let sequence = 0

/**
 * A document-unique id, needed because a <label> points at its input by id and
 * an error message is attached with `aria-describedby`. Two panels on one page
 * must not hand out the same one.
 */
export function uniqueId(prefix) {
  sequence += 1
  return `${prefix}-${sequence.toString(36)}`
}

export function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined && text !== null) node.textContent = String(text)
  return node
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

/** SVG nodes need the namespaced constructor; `createElement` makes an
    HTMLUnknownElement that renders as nothing at all. */
export function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NAMESPACE, tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue
    node.setAttribute(name, String(value))
  }
  return node
}
