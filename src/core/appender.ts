/**
 * UTM Parameter Appender Utility
 *
 * Appends UTM tracking parameters to URLs while preserving existing parameters.
 * Supports both query string and fragment (hash) parameter placement.
 */

import type { AppendOptions, UtmParameters } from '../types'
import { toSnakeCaseParams, isSnakeCaseUtmKey, isCamelCaseUtmKey } from './keys'

/**
 * Builds a query string with proper handling of empty parameter values
 *
 * The standard URLSearchParams.toString() method always includes "=" for parameters,
 * but some tracking systems expect empty parameters without the equals sign.
 *
 * @param params - The parameters to convert to a query string
 * @returns The formatted query string (without leading ?)
 */
function buildQueryString(params: URLSearchParams): string {
  const pairs: string[] = []

  for (const [key, value] of params.entries()) {
    if (value === '') {
      // Empty values: include key only, no equals sign
      pairs.push(encodeURIComponent(key))
    } else {
      // Standard key-value pairs with proper URL encoding
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }

  return pairs.join('&')
}

/**
 * Check if a key is a UTM key (in either format)
 */
function isAnyUtmKey(key: string): boolean {
  return isSnakeCaseUtmKey(key) || isCamelCaseUtmKey(key)
}

/**
 * Check if params object has any valid UTM entries
 */
function hasValidUtmEntries(params: UtmParameters): boolean {
  return Object.entries(params).some(
    ([key, value]) => isAnyUtmKey(key) && value !== undefined && value !== '',
  )
}

/**
 * Appends UTM parameters to a URL
 *
 * Adds or replaces UTM parameters in the URL. By default, adds to the query string,
 * but can optionally add to the URL fragment (hash) instead.
 * SSR-safe: returns original URL if URL constructor is unavailable.
 *
 * @param url - The URL to append UTM parameters to
 * @param utmParams - Object containing UTM parameters to append (snake_case or camelCase)
 * @param options - Append options
 * @returns URL with UTM parameters appended
 *
 * @example
 * ```typescript
 * // Basic usage (query string)
 * appendUtmParameters(
 *   'https://example.com',
 *   { utm_source: 'linkedin', utm_campaign: 'spring2025' }
 * )
 * // Returns: 'https://example.com?utm_source=linkedin&utm_campaign=spring2025'
 *
 * // With camelCase params (auto-converted to snake_case in URL)
 * appendUtmParameters(
 *   'https://example.com',
 *   { utmSource: 'linkedin', utmCampaign: 'spring2025' }
 * )
 * // Returns: 'https://example.com?utm_source=linkedin&utm_campaign=spring2025'
 *
 * // Add to fragment instead of query
 * appendUtmParameters(
 *   'https://example.com',
 *   { utm_source: 'linkedin' },
 *   { toFragment: true }
 * )
 * // Returns: 'https://example.com#utm_source=linkedin'
 *
 * // Preserve existing UTM parameters
 * appendUtmParameters(
 *   'https://example.com?utm_source=old&utm_medium=social',
 *   { utm_source: 'new' },
 *   { preserveExisting: true }
 * )
 * // Returns: 'https://example.com?utm_source=old&utm_medium=social'
 * // (utm_source not replaced because preserveExisting is true)
 * ```
 */
export function appendUtmParameters(
  url: string,
  utmParams: UtmParameters,
  options: AppendOptions = {},
): string {
  const { toFragment = false, preserveExisting = false } = options

  // Fast-path: nothing to append
  if (!hasValidUtmEntries(utmParams)) {
    return url
  }

  // SSR safety check
  if (typeof URL === 'undefined') {
    return url
  }

  try {
    // Convert all params to snake_case for URL usage
    const snakeParams = toSnakeCaseParams(utmParams)

    // Parse the URL
    const urlObj = new URL(url)

    if (toFragment) {
      // === FRAGMENT-BASED PARAMETER ADDITION ===
      return appendToFragment(urlObj, snakeParams, preserveExisting)
    } else {
      // === QUERY-BASED PARAMETER ADDITION (DEFAULT) ===
      return appendToQuery(urlObj, snakeParams, preserveExisting)
    }
  } catch (error) {
    // If URL parsing fails, return the original URL unchanged
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to append UTM parameters to URL:', error)
    }
    return url
  }
}

/**
 * Append UTM parameters to URL query string
 */
function appendToQuery(urlObj: URL, params: UtmParameters, preserveExisting: boolean): string {
  // When adding to query, handle conflicting parameters in fragment
  if (urlObj.hash) {
    const originalFragment = urlObj.hash.substring(1)

    // Only process fragment as parameters if it looks like parameters (contains '=')
    // Regular fragments (like #section) should be left alone
    if (originalFragment.includes('=')) {
      const fragmentParams = new URLSearchParams(originalFragment)

      // Remove tracking parameters from fragment (newer location wins)
      for (const key of Object.keys(params)) {
        fragmentParams.delete(key)
      }

      // Update fragment, clearing it if no parameters remain
      urlObj.hash = fragmentParams.toString() || ''
    }
  }

  // Process query parameters
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue

    if (preserveExisting && urlObj.searchParams.has(key)) {
      // Skip if preserving existing and param already exists
      continue
    }

    // Remove existing parameter first to avoid duplicates
    urlObj.searchParams.delete(key)
    // Add the new parameter
    urlObj.searchParams.set(key, value)
  }

  // Manually rebuild URL to handle empty parameter values correctly
  const queryString = buildQueryString(urlObj.searchParams)
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`

  // Construct final URL with proper fragment handling
  const hash = urlObj.hash
  const finalUrl =
    baseUrl +
    (queryString ? `?${queryString}` : '') +
    (hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '')

  return finalUrl
}

/**
 * Append UTM parameters to URL fragment (hash)
 */
function appendToFragment(urlObj: URL, params: UtmParameters, preserveExisting: boolean): string {
  // Remove conflicting parameters from query string (newer location wins)
  for (const key of Object.keys(params)) {
    urlObj.searchParams.delete(key)
  }

  // Parse existing fragment as parameters
  const fragmentParams = new URLSearchParams(urlObj.hash.substring(1))

  // Process fragment parameters
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue

    if (preserveExisting && fragmentParams.has(key)) {
      // Skip if preserving existing and param already exists
      continue
    }

    // Remove existing parameter first to avoid duplicates
    fragmentParams.delete(key)
    // Add the new parameter
    fragmentParams.set(key, value)
  }

  // Build the fragment string
  urlObj.hash = buildQueryString(fragmentParams)

  return urlObj.toString()
}

/**
 * Remove UTM parameters from a URL
 *
 * Removes all UTM parameters (or specified ones) from both query string and fragment.
 *
 * @param url - The URL to clean
 * @param keysToRemove - Specific UTM keys to remove (removes all if not specified)
 * @returns URL with UTM parameters removed
 *
 * @example
 * ```typescript
 * // Remove all UTM parameters
 * removeUtmParameters('https://example.com?utm_source=x&ref=y')
 * // Returns: 'https://example.com?ref=y'
 *
 * // Remove specific parameters
 * removeUtmParameters(
 *   'https://example.com?utm_source=x&utm_medium=y&utm_campaign=z',
 *   ['utm_source', 'utm_medium']
 * )
 * // Returns: 'https://example.com?utm_campaign=z'
 * ```
 */
export function removeUtmParameters(url: string, keysToRemove?: string[]): string {
  if (typeof URL === 'undefined') {
    return url
  }

  try {
    const urlObj = new URL(url)

    // Remove from query string
    const queryKeysToDelete: string[] = []
    for (const key of urlObj.searchParams.keys()) {
      if (keysToRemove) {
        if (keysToRemove.includes(key)) {
          queryKeysToDelete.push(key)
        }
      } else if (isSnakeCaseUtmKey(key)) {
        queryKeysToDelete.push(key)
      }
    }
    for (const key of queryKeysToDelete) {
      urlObj.searchParams.delete(key)
    }

    // Remove from fragment if it contains parameters
    if (urlObj.hash && urlObj.hash.includes('=')) {
      const fragmentParams = new URLSearchParams(urlObj.hash.substring(1))
      const fragmentKeysToDelete: string[] = []

      for (const key of fragmentParams.keys()) {
        if (keysToRemove) {
          if (keysToRemove.includes(key)) {
            fragmentKeysToDelete.push(key)
          }
        } else if (isSnakeCaseUtmKey(key)) {
          fragmentKeysToDelete.push(key)
        }
      }
      for (const key of fragmentKeysToDelete) {
        fragmentParams.delete(key)
      }

      urlObj.hash = fragmentParams.toString()
    }

    return urlObj.toString()
  } catch {
    return url
  }
}

/**
 * Extract UTM parameters from a URL (both query and fragment)
 *
 * @param url - The URL to extract from
 * @returns Object containing UTM parameters found
 */
export function extractUtmParameters(url: string): UtmParameters {
  if (typeof URL === 'undefined') {
    return {}
  }

  try {
    const urlObj = new URL(url)
    const params: Record<string, string> = {}

    // Extract from query string
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (isSnakeCaseUtmKey(key)) {
        params[key] = value
      }
    }

    // Extract from fragment if it contains parameters
    if (urlObj.hash && urlObj.hash.includes('=')) {
      const fragmentParams = new URLSearchParams(urlObj.hash.substring(1))
      for (const [key, value] of fragmentParams.entries()) {
        if (isSnakeCaseUtmKey(key)) {
          // Fragment params override query params (later in URL = higher priority)
          params[key] = value
        }
      }
    }

    return params as UtmParameters
  } catch {
    return {}
  }
}
