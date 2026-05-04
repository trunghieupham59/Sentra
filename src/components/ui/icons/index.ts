/**
 * Public barrel — re-exports every icon from every category file.
 * Import from here (or from `../icons`) rather than from individual category files.
 *
 * Category breakdown:
 *   actions    — copy, check, trash, arrow-right, download, X, plus, refresh,
 *                send, pencil, image, translate, rewrite, layers, upload
 *   navigation — chevron-down, chevron-right, gear, auto-detect, arrow-up
 *   media      — spinner, stop, speaker, microphone, monitor, subtitles
 *   status     — alert-triangle, radio-checked, info-circle, lightbulb,
 *                check-circle, user
 *   auth       — lock, eye, eye-off
 *   files      — document, clipboard
 */


export * from './actions'
export * from './auth'
export * from './cost'
export * from './files'
export * from './media'
export * from './navigation'
export * from './providers'
export * from './status'
export type { IconProps } from './types'
