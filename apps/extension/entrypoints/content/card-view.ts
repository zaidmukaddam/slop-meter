import {
  CLASSES,
  DECISION_LABEL,
  DIAL_ORDER,
  type Decision,
  type ModelClass,
  type Reason,
  type Score,
  cardNote,
  isRead,
  percent,
  reasonCode,
  shownP,
} from "@slop/model"
import { RULE_NAMES } from "@slop/rules/names"
import { API_HOST } from "../../shared/api"
import { REWRITE_OFF } from "../../shared/messages"
import { escapeHtml } from "./html"

const SNIPPET_WORDS = 8

const swatch = (decision: Decision) => `background: var(--${decision})`
const badge = (decision: Decision) =>
  `<span class="badge"><i class="dot" style="${swatch(decision)}"></i>${DECISION_LABEL[decision]}</span>`
const close = `<button class="close" data-action="close" aria-label="Close">×</button>`

export function cardHtml(score: Score, reasons: Reason[]): string {
  const decided = score.localDecision !== "unsure"
  return `
    <div class="head">
      ${badge(score.localDecision)}
      ${decided ? `<span class="percent">${percent(shownP(score.localP))}</span>` : ""}
      ${close}
    </div>
    <p class="note">${escapeHtml(cardNote(score))}</p>
    ${probabilitiesHtml(score)}
    ${reasonsHtml(reasons)}
    <div class="row">
      <button data-action="wrong">You're wrong</button>
      <button data-action="rewrite">Rewrite</button>
    </div>
    <div class="panel" aria-live="polite"></div>`
}

export function selectionHtml(paragraphs: string[], scores: Score[]): string {
  const rows = scores.map((score, i) => {
    const words = paragraphs[i].split(/\s+/)
    const snippet =
      words.slice(0, SNIPPET_WORDS).join(" ") +
      (words.length > SNIPPET_WORDS ? "…" : "")
    const odds = score.tooShort
      ? "too short"
      : score.notEnglish
        ? "not English"
        : percent(shownP(score.localP))
    return `
      <li>
        <i class="dot" style="${swatch(score.localDecision)}"></i>
        <span>${escapeHtml(snippet)}</span>
        <code>${isRead(score) ? `${DECISION_LABEL[score.localDecision]} ${odds}` : odds}</code>
      </li>`
  })
  return `
    <div class="head">
      <span class="label">${scores.length} paragraphs</span>
      ${close}
    </div>
    <ul class="paragraphs">${rows.join("")}</ul>
    <p class="muted">Each paragraph gets its own call. Select one to see why.</p>`
}

export function notEnglishHtml(): string {
  return `
    <div class="head"><span class="label">Selection</span>${close}</div>
    <p class="note">Every rule here was written for English, so this text isn't read.</p>`
}

export function tooShortHtml(minWords: number): string {
  return `
    <div class="head"><span class="label">Selection</span>${close}</div>
    <p class="note">Select at least ${minWords} words to get a reading.</p>`
}

function probabilitiesHtml(score: Score): string {
  const segments = DIAL_ORDER.map(
    (c) =>
      `<span style="width: ${(score.probs[c] * 100).toFixed(1)}%; ${swatch(c)}"></span>`
  ).join("")
  const numbers = DIAL_ORDER.map(
    (c) =>
      `<div><dt>${DECISION_LABEL[c]}</dt><dd>${percent(score.probs[c], 1)}</dd></div>`
  ).join("")
  return `<div class="bar" aria-hidden="true">${segments}</div><dl class="probs">${numbers}</dl>`
}

function reasonsHtml(reasons: Reason[]): string {
  if (reasons.length === 0) {
    return `<p class="muted">No rule stands out, so the call comes from sentence rhythm and word choice.</p>`
  }
  const items = reasons.map(
    (reason) => `
      <li><span>${escapeHtml(reason.name)}</span><code>${escapeHtml(reasonCode(reason))}</code></li>`
  )
  return `<p class="label">Pushed by</p><ul class="rules">${items.join("")}</ul>`
}

export function labelPickerHtml(predicted: Decision): string {
  const buttons = CLASSES.map((label) => {
    const disabled = label === predicted ? " disabled" : ""
    const name = DECISION_LABEL[label]
    return `<button data-action="label" data-label="${label}"${disabled}>${name[0].toUpperCase() + name.slice(1)}</button>`
  })
  return `
    <p>What is it really?</p>
    <div class="row">${buttons.join("")}</div>`
}

export function savedNoteHtml(saved: boolean, willShare: boolean): string {
  if (!saved) {
    return `<p class="muted">Unable to save this correction. Try again, or reload the page.</p>`
  }
  const where = willShare
    ? `They'll be sent to ${API_HOST}.`
    : "They stay on this device."
  return `<p class="muted">Saved as numbers only, no text. ${where}</p>`
}

export const REWRITE_OFF_HTML = `
  <p class="muted">
    ${REWRITE_OFF}
    It sends this paragraph's text to ${API_HOST}.
  </p>`

export const REWRITE_PENDING_HTML = `<div class="rewrite">Rewriting…</div>`

export function rewriteFooterHtml(removedRuleIds: string[]): string {
  const removed = removedRuleIds.map((id) => {
    const name = RULE_NAMES[id]?.name ?? ""
    return `<code>${escapeHtml(id)}</code> ${escapeHtml(name)}`
  })
  const list = removed.length > 0 ? removed.join(", ") : "none listed"
  return `
    <p class="removed">Removed: ${list}</p>
    <div class="row"><button data-action="copy">Copy</button></div>`
}

export function isLabel(value: string | undefined): value is ModelClass {
  return CLASSES.some((label) => label === value)
}
