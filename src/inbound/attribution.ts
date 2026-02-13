/**
 * Attribution Module
 *
 * Handles first-touch / last-touch UTM parameter storage.
 * Supports three modes: 'last' (default), 'first' (write-once), and 'both'.
 */

import type { AttributionConfig, KeyFormat, StorageType, TouchType, UtmParameters } from '../types'
import {
  storeUtmParameters,
  getStoredUtmParameters,
  hasStoredUtmParameters,
} from '../common/storage'

export interface AttributionStoreOptions {
  attribution: AttributionConfig
  storageKey: string
  storageType: StorageType
  keyFormat: KeyFormat
  ttl?: number
  onStore?: (
    params: UtmParameters,
    meta: { storageType: StorageType; touch?: 'first' | 'last' },
  ) => void
}

export interface AttributionGetOptions {
  attribution: AttributionConfig
  storageKey: string
  storageType: StorageType
  keyFormat: KeyFormat
  touch?: TouchType
}

/**
 * Store UTM params according to the attribution mode.
 *
 * - 'last': writes to main key (current behavior)
 * - 'first': writes to first-touch key only if empty, always writes main key
 * - 'both': writes first-touch (if empty) + last-touch (always) + main key
 */
export function storeWithAttribution(
  params: UtmParameters,
  options: AttributionStoreOptions,
): void {
  const { attribution, storageKey, storageType, keyFormat, ttl, onStore } = options

  const firstKey = storageKey + (attribution.firstTouchSuffix ?? '_first')
  const lastKey = storageKey + (attribution.lastTouchSuffix ?? '_last')
  const baseStorageOpts = { storageType, keyFormat, ttl }

  switch (attribution.mode) {
    case 'last':
      storeUtmParameters(params, { ...baseStorageOpts, storageKey })
      if (onStore) {
        try {
          onStore(params, { storageType, touch: 'last' })
        } catch {
          // Callbacks must not break the pipeline
        }
      }
      break

    case 'first': {
      // Write first-touch only if not already set
      const hasFirst = hasStoredUtmParameters(firstKey, storageType)
      if (!hasFirst) {
        storeUtmParameters(params, { ...baseStorageOpts, storageKey: firstKey })
        if (onStore) {
          try {
            onStore(params, { storageType, touch: 'first' })
          } catch {
            // Callbacks must not break the pipeline
          }
        }
      }
      // Also write to main key
      storeUtmParameters(params, { ...baseStorageOpts, storageKey })
      break
    }

    case 'both': {
      // First-touch: write-once
      const hasFirstTouch = hasStoredUtmParameters(firstKey, storageType)
      if (!hasFirstTouch) {
        storeUtmParameters(params, { ...baseStorageOpts, storageKey: firstKey })
        if (onStore) {
          try {
            onStore(params, { storageType, touch: 'first' })
          } catch {
            // Callbacks must not break the pipeline
          }
        }
      }
      // Last-touch: always update
      storeUtmParameters(params, { ...baseStorageOpts, storageKey: lastKey })
      if (onStore) {
        try {
          onStore(params, { storageType, touch: 'last' })
        } catch {
          // Callbacks must not break the pipeline
        }
      }
      // Also write to main key (same as last-touch)
      storeUtmParameters(params, { ...baseStorageOpts, storageKey })
      break
    }

    default: {
      const _exhaustiveCheck: never = attribution.mode
      throw new Error(`Unknown attribution mode: ${_exhaustiveCheck}`)
    }
  }
}

/**
 * Read attributed params from the correct storage key.
 *
 * Default touch depends on mode:
 * - 'first' mode → defaults to first-touch
 * - 'last' / 'both' mode → defaults to last-touch
 */
export function getAttributedParams(options: AttributionGetOptions): UtmParameters | null {
  const { attribution, storageKey, storageType, keyFormat, touch } = options

  const firstKey = storageKey + (attribution.firstTouchSuffix ?? '_first')
  const lastKey = storageKey + (attribution.lastTouchSuffix ?? '_last')

  // Determine which touch type to read
  let effectiveTouch: TouchType
  if (touch) {
    effectiveTouch = touch
  } else if (attribution.mode === 'first') {
    effectiveTouch = 'first'
  } else {
    effectiveTouch = 'last'
  }

  if (effectiveTouch === 'first') {
    return getStoredUtmParameters({ storageKey: firstKey, storageType, keyFormat })
  }

  // For 'last' touch in 'both' mode, read from last-touch key
  if (attribution.mode === 'both') {
    return getStoredUtmParameters({ storageKey: lastKey, storageType, keyFormat })
  }

  // For 'last' mode, read from main key
  return getStoredUtmParameters({ storageKey, storageType, keyFormat })
}
