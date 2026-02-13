/**
 * UtmHiddenFields Component
 *
 * Renders hidden input elements for all stored UTM parameters.
 * Useful for embedding UTM data in form submissions.
 */

import React from 'react'
import type { KeyFormat } from '../types'
import { getStoredUtmParameters } from '../common/storage'

export interface UtmHiddenFieldsProps {
  keyFormat?: KeyFormat
  prefix?: string
  storageKey?: string
  storageType?: 'session' | 'local'
}

export function UtmHiddenFields(props: UtmHiddenFieldsProps): React.ReactElement | null {
  const { keyFormat = 'snake_case', prefix = '', storageKey, storageType } = props

  const params = getStoredUtmParameters({ storageKey, storageType, keyFormat })

  if (!params || Object.keys(params).length === 0) {
    return null
  }

  return (
    <>
      {Object.entries(params).map(([key, value]) => {
        if (value === undefined) return null
        return <input key={key} type="hidden" name={`${prefix}${key}`} value={value} />
      })}
    </>
  )
}
