/**
 * Automatic Link Decoration
 *
 * Auto-appends UTM params to links on a page.
 * Supports host filtering, skip-existing, and MutationObserver for SPAs.
 */

import type { StorageType, TouchType, UtmParameters } from '../types'
import { getStoredUtmParameters } from '../common/storage'
import { appendUtmParameters, extractUtmParameters } from './appender'

export interface LinkDecoratorOptions {
  /** CSS selector for links (default: 'a[href]') */
  selector?: string
  /** Only decorate internal links — same host (default: true) */
  internalOnly?: boolean
  /** Additional hosts to include (when internalOnly is true) */
  includeHosts?: string[]
  /** Hosts to always exclude */
  excludeHosts?: string[]
  /** Skip links that already have UTM params (default: true) */
  skipExisting?: boolean
  /** Which touch params to use (default: 'last') */
  touch?: TouchType
  /** Additional static params to append */
  extraParams?: UtmParameters
  /** Storage options for reading params */
  storageKey?: string
  storageType?: StorageType
  /** Callback for each decorated link */
  onAppend?: (url: string, params: UtmParameters) => void
}

/**
 * Decorate all matching links on the page.
 * Returns count of links decorated.
 */
export function decorateLinks(options: LinkDecoratorOptions = {}): number {
  const {
    selector = 'a[href]',
    internalOnly = true,
    includeHosts = [],
    excludeHosts = [],
    skipExisting = true,
    storageKey,
    storageType,
    extraParams,
    onAppend,
  } = options

  if (typeof document === 'undefined') return 0

  const params = getStoredUtmParameters({ storageKey, storageType })
  if (!params || Object.keys(params).length === 0) return 0

  // Merge stored params with extra static params
  const mergedParams: UtmParameters = extraParams ? { ...params, ...extraParams } : params

  const links = document.querySelectorAll<HTMLAnchorElement>(selector)
  if (links.length === 0) return 0

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
  const includeSet = new Set(includeHosts.map((h) => h.toLowerCase()))
  const excludeSet = new Set(excludeHosts.map((h) => h.toLowerCase()))

  let count = 0

  for (const link of links) {
    const href = link.href
    if (!href) continue

    let linkHost: string
    try {
      linkHost = new URL(href).hostname.toLowerCase()
    } catch {
      continue
    }

    // Exclude specified hosts
    if (excludeSet.has(linkHost)) continue

    // Internal-only filter
    if (internalOnly) {
      const isInternal = linkHost === currentHost.toLowerCase()
      const isIncluded = includeSet.has(linkHost)
      if (!isInternal && !isIncluded) continue
    }

    // Skip links that already have UTM params
    if (skipExisting) {
      const existing = extractUtmParameters(href)
      if (Object.keys(existing).length > 0) continue
    }

    // Decorate the link
    const decoratedUrl = appendUtmParameters(href, mergedParams)
    link.href = decoratedUrl
    count++

    if (onAppend) {
      try {
        onAppend(decoratedUrl, mergedParams)
      } catch {
        // Callbacks must not break the pipeline
      }
    }
  }

  return count
}

/**
 * Watch for new links via MutationObserver.
 * Returns cleanup function to disconnect the observer.
 */
export function observeAndDecorateLinks(options: LinkDecoratorOptions = {}): () => void {
  // Decorate existing links immediately
  decorateLinks(options)

  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  let decorating = false
  const observer = new MutationObserver(() => {
    // Prevent re-entrant decoration (our own href mutations trigger MutationObserver)
    if (decorating) return
    decorating = true
    try {
      decorateLinks(options)
    } finally {
      decorating = false
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  return () => observer.disconnect()
}
