/**
 * Public barrel — re-exports every icon from every category file.
 * Import from here (or from `../icons`) rather than from individual category files.
 *
 * Category breakdown:
 *   actions    — copy, check, trash, arrow-right, download, X, plus, refresh,
 *                send, pencil, image, translate, rewrite, layers
 *   navigation — chevron-down, chevron-right, gear, auto-detect, arrow-up
 *   media      — spinner, stop, speaker, microphone, monitor, subtitles
 *   status     — alert-triangle, radio-checked, info-circle, lightbulb,
 *                check-circle, user
 *   auth       — lock, eye, eye-off
 *   files      — document, clipboard
 */
export type { IconProps } from './types'

export * from './actions'
export * from './navigation'
export * from './media'
export * from './status'
export * from './auth'
export * from './files'
