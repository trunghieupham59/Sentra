/**
 * BookmarkletDragLink — draggable bookmarklet anchor with loading state.
 * Extracted from SettingsPage (Legacy Browser Translate › Bookmarklet step 1).
 *
 * The `href` is set via a DOM ref instead of React's href prop to avoid
 * React's security warning about javascript: URLs (which is expected for
 * bookmarklets — the javascript: scheme is intentional here).
 */
import { useLayoutEffect, useRef } from 'react'
import { ArrowUpIcon, LayersIcon, SpinnerIcon } from './icons'

interface BookmarkletDragLinkProps {
  /** The bookmarklet javascript: URL. Empty string while still loading. */
  href: string
  /** Text shown while the URL hasn't loaded yet. */
  loadingText: string
}

export function BookmarkletDragLink({ href, loadingText }: BookmarkletDragLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  // Set href directly on the DOM node to bypass React's javascript: URL warning.
  // React intentionally sanitises javascript: URLs in JSX props; for a bookmarklet
  // this scheme is required so we write it through the native setAttribute API.
  // useLayoutEffect runs synchronously before the browser paints, so the
  // javascript: href is in place before the user can see or drag the element.
  useLayoutEffect(() => {
    if (linkRef.current && href) {
      linkRef.current.setAttribute('href', href)
    }
  }, [href])

  if (!href) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-400 dark:text-gray-500">
        <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
        {loadingText}
      </div>
    )
  }

  return (
    // biome-ignore lint: href is a javascript: bookmarklet URL set via DOM ref; <a> is required for drag-to-bookmark-bar
    <a
      ref={linkRef}
      href="#" // Placeholder replaced by useLayoutEffect before paint — needed so biome sees a valid anchor
      onClick={(e) => e.preventDefault()}
      draggable
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                 bg-white dark:bg-gray-700 border-2 border-dashed border-blue-300 dark:border-blue-700
                 text-sm font-medium text-blue-700 dark:text-blue-300
                 cursor-grab active:cursor-grabbing select-none
                 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
    >
      <LayersIcon className="w-4 h-4 text-blue-500" />
      🌐 Lotus Translate
      <ArrowUpIcon className="w-3.5 h-3.5 text-blue-400" />
    </a>
  )
}
