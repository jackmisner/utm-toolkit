/**
 * UTM Tracking React Hook
 *
 * React hook for managing UTM parameter capture, storage, and appending.
 * Provides a simple API for UTM tracking throughout React applications.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  UtmConfig,
  UtmParameters,
  ResolvedUtmConfig,
  SharePlatform,
  UseUtmTrackingReturn,
} from '../types'
import { captureUtmParameters, hasUtmParameters as checkHasParams } from '../core/capture'
import {
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
} from '../core/storage'
import { appendUtmParameters } from '../core/appender'
import { convertParams, isSnakeCaseUtmKey } from '../core/keys'
import { createConfig } from '../config/loader'

/**
 * Options for the useUtmTracking hook
 */
export interface UseUtmTrackingOptions {
  /** Configuration options (will be merged with defaults) */
  config?: Partial<UtmConfig>
}

/**
 * React hook for managing UTM tracking
 *
 * Provides functions to capture, store, and append UTM parameters.
 * Handles auto-capture on mount if configured.
 *
 * @param options - Hook options including configuration
 * @returns Object containing UTM state and helper functions
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * function MyComponent() {
 *   const { utmParameters, appendToUrl } = useUtmTracking();
 *   const shareUrl = appendToUrl('https://example.com/results');
 * }
 *
 * // With custom configuration
 * function MyComponent() {
 *   const { capture, appendToUrl } = useUtmTracking({
 *     config: {
 *       keyFormat: 'camelCase',
 *       storageKey: 'myapp_utm',
 *       shareContextParams: {
 *         linkedin: { utm_content: 'linkedin_share' }
 *       }
 *     }
 *   });
 * }
 *
 * // Manual capture (when captureOnMount is false)
 * function MyComponent() {
 *   const { capture, isEnabled } = useUtmTracking({
 *     config: { captureOnMount: false }
 *   });
 *
 *   useEffect(() => {
 *     if (isEnabled) {
 *       capture();
 *     }
 *   }, [capture, isEnabled]);
 * }
 * ```
 */
export function useUtmTracking(options: UseUtmTrackingOptions = {}): UseUtmTrackingReturn {
  // Create resolved config (merges with defaults)
  const resolvedConfig = useRef<ResolvedUtmConfig>(createConfig(options.config))

  // Track if we've initialized
  const hasInitialized = useRef(false)

  // Get config values for easier access
  const config = resolvedConfig.current
  const isEnabled = config.enabled

  // State to store current UTM parameters
  const [utmParameters, setUtmParameters] = useState<UtmParameters | null>(() => {
    // SSR safety check
    if (typeof window === 'undefined') {
      return null
    }

    // Initialize from storage if enabled
    if (isEnabled) {
      const stored = getStoredUtmParameters({
        storageKey: config.storageKey,
        keyFormat: config.keyFormat,
      })
      return stored
    }
    return null
  })

  /**
   * Capture UTM parameters from current URL
   */
  const capture = useCallback(() => {
    if (!isEnabled) {
      return
    }

    // SSR safety check
    if (typeof window === 'undefined') {
      return
    }

    // Capture UTM parameters from current URL
    const params = captureUtmParameters(window.location.href, {
      keyFormat: config.keyFormat,
      allowedParameters: config.allowedParameters,
    })

    // Only store if we found some parameters
    if (checkHasParams(params)) {
      storeUtmParameters(params, {
        storageKey: config.storageKey,
        keyFormat: config.keyFormat,
      })
      setUtmParameters(params)
    } else if (checkHasParams(config.defaultParams)) {
      // Use default parameters if no UTMs found and defaults are configured
      const defaultParams = convertParams(config.defaultParams, config.keyFormat)
      storeUtmParameters(defaultParams, {
        storageKey: config.storageKey,
        keyFormat: config.keyFormat,
      })
      setUtmParameters(defaultParams)
    }
  }, [isEnabled, config])

  /**
   * Clear stored UTM parameters
   */
  const clear = useCallback(() => {
    clearStoredUtmParameters(config.storageKey)
    setUtmParameters(null)
  }, [config.storageKey])

  /**
   * Append UTM parameters to a URL
   */
  const appendToUrl = useCallback(
    (url: string, platform?: SharePlatform): string => {
      // If tracking disabled or not configured to append, return URL unchanged
      if (!isEnabled || !config.appendToShares) {
        return url
      }

      // Build merged parameters: captured < default share < platform-specific
      let mergedParams: UtmParameters = {}

      // Start with captured UTMs (if any)
      if (utmParameters && checkHasParams(utmParameters)) {
        mergedParams = { ...utmParameters }
      }

      // Merge share context parameters if configured
      if (config.shareContextParams) {
        // Apply default share context params first
        if (config.shareContextParams.default) {
          mergedParams = { ...mergedParams, ...config.shareContextParams.default }
        }

        // Apply platform-specific params (higher priority)
        if (platform && config.shareContextParams[platform]) {
          const platformParams = config.shareContextParams[platform]
          if (platformParams) {
            mergedParams = { ...mergedParams, ...platformParams }
          }
        }
      }

      // Filter out parameters that should not be shared
      if (config.excludeFromShares && config.excludeFromShares.length > 0) {
        const excludeSet = new Set(config.excludeFromShares)
        mergedParams = Object.fromEntries(
          Object.entries(mergedParams).filter(([key]) => {
            // Convert to snake_case for comparison if needed
            const snakeKey = isSnakeCaseUtmKey(key)
              ? key
              : `utm_${key
                  .slice(3)
                  .replace(/([A-Z])/g, '_$1')
                  .toLowerCase()}`
            return !excludeSet.has(snakeKey) && !excludeSet.has(key)
          }),
        ) as UtmParameters
      }

      // If no parameters to append, return URL unchanged
      if (!checkHasParams(mergedParams)) {
        return url
      }

      return appendUtmParameters(url, mergedParams)
    },
    [isEnabled, config, utmParameters],
  )

  // Auto-capture on mount if configured
  useEffect(() => {
    if (hasInitialized.current) {
      return
    }
    hasInitialized.current = true

    if (isEnabled && config.captureOnMount) {
      capture()
    }
  }, [isEnabled, config.captureOnMount, capture])

  // Compute hasParams
  const hasParams = checkHasParams(utmParameters)

  return {
    utmParameters,
    isEnabled,
    hasParams,
    capture,
    clear,
    appendToUrl,
  }
}
