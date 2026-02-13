/**
 * useUtmFormData Hook
 *
 * Returns UTM data as a flat key-value record for use with form libraries.
 */

import { useMemo } from 'react'
import type { TouchType } from '../types'
import { getStoredUtmParameters } from '../common/storage'

export interface UseUtmFormDataOptions {
  touch?: TouchType
  storageKey?: string
  storageType?: 'session' | 'local'
  keyFormat?: 'snake_case' | 'camelCase'
}

export function useUtmFormData(options: UseUtmFormDataOptions = {}): Record<string, string> {
  const { keyFormat = 'snake_case', storageKey, storageType } = options

  return useMemo(() => {
    const params = getStoredUtmParameters({ storageKey, storageType, keyFormat })
    if (!params) return {}

    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        result[key] = value
      }
    }
    return result
  }, [storageKey, storageType, keyFormat])
}
