/**
 * A labelled numeric input for a simulation parameter.
 *
 * Built on a native `<input type="number">` so it is keyboard-operable
 * without any code of its own: tab reaches it, arrows step it, and a screen
 * reader announces it as a spin button with its range. What is added on top
 * is the part the platform does not give — a unit shown beside the value
 * rather than buried in the label, and a validation message that is both
 * visible and wired to the input with `aria-describedby`, so it is read out
 * on focus instead of only being a red border.
 *
 * The rules themselves live in `numeric.js` and are pure; this file renders
 * the verdict.
 */

import { element, uniqueId } from "./dom.js"
import { validateNumericInput } from "./numeric.js"

export function createNumericField(options = {}) {
  const {
    label,
    unit = "",
    value = "",
    min,
    max,
    step,
    stepBase,
    hint,
    required = true,
    onChange,
  } = options

  if (typeof label !== "string" || label === "") {
    throw new TypeError("label is required")
  }

  const root = element("div", "sim-field")
  const inputId = uniqueId("sim-field")
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`

  const labelNode = element("label", "sim-field-label", label)
  labelNode.htmlFor = inputId

  const wrapper = element("div", "sim-field-input")
  const input = document.createElement("input")
  input.type = "number"
  input.id = inputId
  input.value = value === null || value === undefined ? "" : String(value)
  if (typeof min === "number") input.min = String(min)
  if (typeof max === "number") input.max = String(max)
  if (typeof step === "number") input.step = String(step)
  if (required) input.required = true
  // `text` rather than `decimal`: a physical input may be negative or given
  // in exponential form, and the decimal keypad offers neither.
  input.inputMode = "text"
  wrapper.append(input)

  if (unit) {
    // The unit is decoration beside the field, but it is also half the
    // meaning of the number, so it is announced as part of the input's
    // description rather than hidden from assistive technology.
    const unitNode = element("span", "sim-field-unit", unit)
    unitNode.id = `${inputId}-unit`
    wrapper.append(unitNode)
  }

  const hintNode = hint ? element("p", "sim-field-hint", hint) : null
  if (hintNode) hintNode.id = hintId

  const errorNode = element("p", "sim-field-error")
  errorNode.id = errorId
  // Assertive rather than polite: the reader is about to run a solver with
  // this number, and a queued announcement arrives after they have moved on.
  errorNode.setAttribute("role", "alert")

  input.setAttribute(
    "aria-describedby",
    [unit ? `${inputId}-unit` : null, hintNode ? hintId : null, errorId]
      .filter(Boolean)
      .join(" ")
  )

  root.append(labelNode, wrapper)
  if (hintNode) root.append(hintNode)
  root.append(errorNode)

  let state = { valid: true, value: null, error: null }

  function validate() {
    state = validateNumericInput(input.value, {
      label,
      unit,
      min,
      max,
      step,
      stepBase,
      required,
    })

    errorNode.textContent = state.error ?? ""
    root.dataset.invalid = state.valid ? "false" : "true"
    input.setAttribute("aria-invalid", state.valid ? "false" : "true")
    return state
  }

  // `input` rather than `change`: a value that is already out of range should
  // say so while it is being typed, not once focus leaves.
  input.addEventListener("input", () => {
    validate()
    onChange?.(state, api)
  })

  validate()

  const api = {
    root,
    input,
    label,
    unit,
    get state() {
      return state
    },
    get value() {
      return state.value
    },
    get valid() {
      return state.valid
    },
    set(next) {
      input.value = next === null || next === undefined ? "" : String(next)
      return validate()
    },
    validate,
    focus: () => input.focus(),
    disable(disabled = true) {
      input.disabled = disabled
    },
    remove: () => root.remove(),
  }

  return api
}

/**
 * Validate a group of fields at once and report what is wrong.
 *
 * Returned rather than thrown: a form with three bad numbers should show all
 * three, and the caller usually wants to disable a "run" button rather than
 * handle an exception.
 */
export function validateFields(fields) {
  const states = fields.map((field) => ({ field, state: field.validate() }))
  const invalid = states.filter((entry) => !entry.state.valid)

  return {
    valid: invalid.length === 0,
    errors: invalid.map((entry) => entry.state.error),
    values: Object.fromEntries(
      states.map((entry) => [entry.field.label, entry.state.value])
    ),
    focusFirstInvalid() {
      invalid[0]?.field.focus()
    },
  }
}
