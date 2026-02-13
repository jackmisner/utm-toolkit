/**
 * UTM Tracking React Hook
 *
 * React hook for managing UTM parameter capture, storage, and appending.
 * Provides a simple API for UTM tracking throughout React applications.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type {
  UtmConfig,
  UtmParameters,
  ResolvedUtmConfig,
  SharePlatform,
  UseUtmTrackingReturn,
} from '../types'
import { captureUtmParameters, hasUtmParameters as checkHasParams } from '../inbound/capture'
import { getStoredUtmParameters, clearStoredUtmParameters } from '../common/storage'
import { storeWithAttribution } from '../inbound/attribution'
import { appendUtmParameters } from '../outbound/appender'
import { convertParams, isSnakeCaseUtmKey } from '../common/keys'
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
        storageType: config.storageType,
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
      sanitize: config.sanitize,
      piiFiltering: config.piiFiltering,
      onCapture: config.onCapture,
    })

    // Only store if we found some parameters
    if (checkHasParams(params)) {
      storeWithAttribution(params, {
        attribution: config.attribution,
        storageKey: config.storageKey,
        keyFormat: config.keyFormat,
        storageType: config.storageType,
        ttl: config.ttl,
        onStore: config.onStore,
      })
      setUtmParameters(params)
    } else if (checkHasParams(config.defaultParams)) {
      // Use default parameters if no UTMs found and defaults are configured
      const defaultParams = convertParams(config.defaultParams, config.keyFormat)
      storeWithAttribution(defaultParams, {
        attribution: config.attribution,
        storageKey: config.storageKey,
        keyFormat: config.keyFormat,
        storageType: config.storageType,
        ttl: config.ttl,
        onStore: config.onStore,
      })
      setUtmParameters(defaultParams)
    }
  }, [isEnabled, config])

  /**
   * Clear stored UTM parameters
   */
  const clear = useCallback(() => {
    // Clear main key
    clearStoredUtmParameters({
      storageKey: config.storageKey,
      storageType: config.storageType,
      onClear: config.onClear,
    })
    // Also clear attribution-suffixed keys if attribution is configured
    const mode = config.attribution?.mode ?? 'last'
    if (mode === 'first' || mode === 'both') {
      const firstKey = config.storageKey + (config.attribution?.firstTouchSuffix ?? '_first')
      clearStoredUtmParameters({ storageKey: firstKey, storageType: config.storageType })
    }
    if (mode === 'both') {
      const lastKey = config.storageKey + (config.attribution?.lastTouchSuffix ?? '_last')
      clearStoredUtmParameters({ storageKey: lastKey, storageType: config.storageType })
    }
    setUtmParameters(null)
  }, [config.storageKey, config.storageType, config.onClear, config.attribution])

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

      return appendUtmParameters(url, mergedParams, { onAppend: config.onAppend })
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

  // Attribution mode determines which touch params are available
  const attributionMode = config.attribution?.mode ?? 'last'
  const firstTouchParams = useMemo(
    () =>
      attributionMode === 'last'
        ? null
        : getStoredUtmParameters({
            storageKey: config.storageKey + (config.attribution?.firstTouchSuffix ?? '_first'),
            keyFormat: config.keyFormat,
            storageType: config.storageType,
          }),
    // Re-read when utmParameters changes (i.e., after capture/store)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attributionMode, config.storageKey, config.keyFormat, config.storageType, utmParameters],
  )
  const lastTouchParams = useMemo(
    () =>
      attributionMode === 'first'
        ? null
        : attributionMode === 'both'
          ? getStoredUtmParameters({
              storageKey: config.storageKey + (config.attribution?.lastTouchSuffix ?? '_last'),
              keyFormat: config.keyFormat,
              storageType: config.storageType,
            })
          : utmParameters,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attributionMode, config.storageKey, config.keyFormat, config.storageType, utmParameters],
  )

  return {
    utmParameters,
    isEnabled,
    hasParams,
    capture,
    clear,
    appendToUrl,
    firstTouchParams,
    lastTouchParams,
  }
}
