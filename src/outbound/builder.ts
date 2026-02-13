/**
 * UTM Link Builder
 *
 * Structured API for constructing UTM-tagged URLs with validation.
 * Uses existing validateUrl, normalizeUrl, and appendUtmParameters internally.
 */

import type { UtmParameters } from '../types'
import { validateUrl, normalizeUrl } from '../common/validator'
import { appendUtmParameters } from './appender'

const UNSAFE_CHARS = /[&=?#]/

export interface BuildUtmUrlParams {
  url: string
  source: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
  id?: string
}

export interface BuildUtmUrlOptions {
  /** Validate the base URL (default: true) */
  validate?: boolean
  /** Normalize the URL — add https:// if missing (default: true) */
  normalize?: boolean
  /** Lowercase all param values (default: false) */
  lowercaseValues?: boolean
  /** Fire callback after building */
  onAppend?: (url: string, params: UtmParameters) => void
}

export interface BuildResult {
  url: string
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate param values for unsafe characters and case consistency
 */
export function validateUtmValues(params: Partial<Omit<BuildUtmUrlParams, 'url'>>): {
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  const entries: [string, string | undefined][] = [
    ['source', params.source],
    ['medium', params.medium],
    ['campaign', params.campaign],
    ['term', params.term],
    ['content', params.content],
    ['id', params.id],
  ]

  for (const [name, value] of entries) {
    if (value === undefined || value === '') continue

    if (UNSAFE_CHARS.test(value)) {
      errors.push(`${name} contains unsafe characters (& = ? #)`)
    }

    if (/[A-Z]/.test(value)) {
      warnings.push(`${name} contains uppercase characters`)
    }
  }

  return { errors, warnings }
}

/**
 * Build a UTM-tagged URL from structured input with validation.
 */
export function buildUtmUrl(
  params: BuildUtmUrlParams,
  options: BuildUtmUrlOptions = {},
): BuildResult {
  const { validate = true, normalize = true, lowercaseValues = false, onAppend } = options

  const errors: string[] = []
  const warnings: string[] = []

  // Validate required fields
  if (!params.source || params.source.trim() === '') {
    errors.push('source is required')
  }

  // Apply lowercase if configured
  const effectiveParams: BuildUtmUrlParams = lowercaseValues
    ? {
        ...params,
        source: params.source?.toLowerCase() ?? '',
        medium: params.medium?.toLowerCase(),
        campaign: params.campaign?.toLowerCase(),
        term: params.term?.toLowerCase(),
        content: params.content?.toLowerCase(),
        id: params.id?.toLowerCase(),
      }
    : params

  // Validate param values
  const { errors: valueErrors, warnings: valueWarnings } = validateUtmValues(effectiveParams)
  errors.push(...valueErrors)
  warnings.push(...valueWarnings)

  // Normalize URL if configured
  let url = effectiveParams.url
  if (normalize) {
    url = normalizeUrl(url)
  }

  // Validate URL if configured
  if (validate) {
    const validation = validateUrl(url)
    if (!validation.valid) {
      errors.push('url is invalid')
    }
  }

  // If there are errors, return early
  if (errors.length > 0) {
    return { url: params.url, valid: false, errors, warnings }
  }

  // Build UTM params object
  const utmParams: UtmParameters = { utm_source: effectiveParams.source }
  if (effectiveParams.medium) utmParams.utm_medium = effectiveParams.medium
  if (effectiveParams.campaign) utmParams.utm_campaign = effectiveParams.campaign
  if (effectiveParams.term) utmParams.utm_term = effectiveParams.term
  if (effectiveParams.content) utmParams.utm_content = effectiveParams.content
  if (effectiveParams.id) utmParams.utm_id = effectiveParams.id

  // Construct final URL
  const finalUrl = appendUtmParameters(url, utmParams)

  if (onAppend) {
    try {
      onAppend(finalUrl, utmParams)
    } catch {
      // Callbacks must not break the pipeline
    }
  }

  return { url: finalUrl, valid: true, errors: [], warnings }
}
