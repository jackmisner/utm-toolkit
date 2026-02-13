/**
 * Form Field Population
 *
 * Injects stored UTM params into HTML form fields.
 * Supports three strategies: name-based, data-attribute, and auto-create.
 */

import type { KeyFormat, StorageType, TouchType, UtmParameters } from '../types'
import { getStoredUtmParameters } from '../common/storage'

export interface FormPopulateOptions {
  /** CSS selector for forms (default: 'form') */
  selector?: string
  /** Field targeting strategy */
  strategy?: 'name' | 'data-attribute' | 'auto-create'
  /** Data attribute name for 'data-attribute' strategy (default: 'data-utm') */
  dataAttribute?: string
  /** Which touch to populate from (default: 'last') */
  touch?: TouchType
  /** Key format for field names (default: 'snake_case') */
  keyFormat?: KeyFormat
  /** Storage options for reading params */
  storageKey?: string
  storageType?: StorageType
}

/**
 * Populate matching form fields with stored UTM data.
 * Returns count of fields populated.
 */
export function populateFormFields(options: FormPopulateOptions = {}): number {
  const {
    selector = 'form',
    strategy = 'auto-create',
    dataAttribute = 'data-utm',
    keyFormat = 'snake_case',
    storageKey,
    storageType,
  } = options

  if (typeof document === 'undefined') return 0

  const params = getStoredUtmParameters({ storageKey, storageType, keyFormat })
  if (!params || Object.keys(params).length === 0) return 0

  const forms = document.querySelectorAll(selector)
  if (forms.length === 0) return 0

  let count = 0

  switch (strategy) {
    case 'name':
      count = populateByName(forms, params)
      break
    case 'data-attribute':
      count = populateByDataAttribute(forms, params, dataAttribute)
      break
    case 'auto-create':
      count = autoCreateFields(forms, params)
      break
  }

  return count
}

/**
 * Create hidden input elements in matching forms.
 * Returns count of fields created.
 */
export function createUtmHiddenFields(options: Omit<FormPopulateOptions, 'strategy'> = {}): number {
  const { selector = 'form', keyFormat = 'snake_case', storageKey, storageType } = options

  if (typeof document === 'undefined') return 0

  const params = getStoredUtmParameters({ storageKey, storageType, keyFormat })
  if (!params || Object.keys(params).length === 0) return 0

  const forms = document.querySelectorAll(selector)
  if (forms.length === 0) return 0

  return autoCreateFields(forms, params)
}

/**
 * Strategy: name — find inputs with name matching UTM keys and set values
 */
function populateByName(forms: NodeListOf<Element>, params: UtmParameters): number {
  let count = 0
  for (const form of forms) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue
      const input = form.querySelector(`input[name="${key}"]`) as HTMLInputElement | null
      if (input) {
        input.value = value
        count++
      }
    }
  }
  return count
}

/**
 * Strategy: data-attribute — find inputs with data-utm="source" etc.
 */
function populateByDataAttribute(
  forms: NodeListOf<Element>,
  params: UtmParameters,
  dataAttribute: string,
): number {
  let count = 0
  // Build a map from short name to value (e.g., "source" → "google")
  const shortNameMap = new Map<string, string>()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    // Strip utm_ prefix to get short name
    const shortName = key.replace(/^utm_/, '').replace(/^utm/, '')
    if (shortName) {
      // Handle snake_case: utm_source → source
      shortNameMap.set(shortName.toLowerCase(), value)
    }
  }

  for (const form of forms) {
    for (const [shortName, value] of shortNameMap) {
      const input = form.querySelector(
        `input[${dataAttribute}="${shortName}"]`,
      ) as HTMLInputElement | null
      if (input) {
        input.value = value
        count++
      }
    }
  }
  return count
}

/**
 * Strategy: auto-create — create hidden inputs for all UTM params
 */
function autoCreateFields(forms: NodeListOf<Element>, params: UtmParameters): number {
  let count = 0
  for (const form of forms) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue
      // Check if a hidden input with this name already exists
      const existing = form.querySelector(
        `input[type="hidden"][name="${key}"]`,
      ) as HTMLInputElement | null
      if (existing) {
        existing.value = value
      } else {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      }
      count++
    }
  }
  return count
}
