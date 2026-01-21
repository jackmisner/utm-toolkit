/**
 * URL Validation and Normalization Utilities
 *
 * Provides URL validation and normalization functionality.
 * - Protocol validation (HTTP/HTTPS only by default)
 * - Domain structure validation (requires TLD)
 * - URL normalization (add protocol if missing)
 */

import type { ValidationResult, ValidationError } from '../types'

/**
 * Error messages for validation errors
 */
export const ERROR_MESSAGES: Record<ValidationError, string> = {
  invalid_protocol: 'Only HTTP and HTTPS URLs are supported',
  invalid_domain: 'URL must have a valid domain with a TLD (e.g., example.com)',
  malformed_url: 'URL is malformed or invalid',
  empty_url: 'URL cannot be empty',
}

/**
 * Allowed protocols for URL validation
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * Default protocol to add when normalizing URLs
 */
let defaultProtocol = 'https://'

/**
 * Validate URL protocol
 */
function validateProtocol(protocol: string): ValidationResult {
  if (!ALLOWED_PROTOCOLS.includes(protocol)) {
    return {
      valid: false,
      error: 'invalid_protocol',
      message: ERROR_MESSAGES.invalid_protocol,
    }
  }
  return { valid: true }
}

/**
 * Validate domain structure
 */
function validateDomain(hostname: string): ValidationResult {
  // Empty hostname check
  if (!hostname || hostname === '.') {
    return {
      valid: false,
      error: 'invalid_domain',
      message: ERROR_MESSAGES.invalid_domain,
    }
  }

  // TLD requirement - must contain at least one dot
  if (!hostname.includes('.')) {
    return {
      valid: false,
      error: 'invalid_domain',
      message: ERROR_MESSAGES.invalid_domain,
    }
  }

  // Ensure hostname is not just dots
  if (hostname.replace(/\./g, '') === '') {
    return {
      valid: false,
      error: 'invalid_domain',
      message: ERROR_MESSAGES.invalid_domain,
    }
  }

  return { valid: true }
}

/**
 * Check if a URL string has a protocol
 */
function hasProtocol(url: string): boolean {
  return url.includes('://')
}

/**
 * Validate a URL
 *
 * Checks that the URL:
 * - Is a non-empty string
 * - Has a valid protocol (HTTP/HTTPS)
 * - Has a valid domain with a TLD
 *
 * @param url - The URL to validate
 * @returns Validation result with success flag and optional error details
 *
 * @example
 * ```typescript
 * validateUrl('https://example.com')
 * // Returns: { valid: true }
 *
 * validateUrl('ftp://example.com')
 * // Returns: { valid: false, error: 'invalid_protocol', message: '...' }
 *
 * validateUrl('https://localhost')
 * // Returns: { valid: false, error: 'invalid_domain', message: '...' }
 * ```
 */
export function validateUrl(url: string): ValidationResult {
  // Empty URL check
  if (typeof url !== 'string' || !url.trim()) {
    return {
      valid: false,
      error: 'empty_url',
      message: ERROR_MESSAGES.empty_url,
    }
  }

  try {
    const urlObj = new URL(url)

    // Protocol validation
    const protocolResult = validateProtocol(urlObj.protocol)
    if (!protocolResult.valid) {
      return protocolResult
    }

    // Domain validation
    const domainResult = validateDomain(urlObj.hostname)
    if (!domainResult.valid) {
      return domainResult
    }

    return { valid: true }
  } catch {
    return {
      valid: false,
      error: 'malformed_url',
      message: ERROR_MESSAGES.malformed_url,
    }
  }
}

/**
 * Normalize a URL by adding protocol if missing
 *
 * Handles the common case where users input URLs without explicit protocols
 * (e.g., "example.com" becomes "https://example.com").
 *
 * @param url - The URL to normalize
 * @returns The normalized URL with protocol
 *
 * @example
 * ```typescript
 * normalizeUrl('example.com')
 * // Returns: 'https://example.com'
 *
 * normalizeUrl('https://example.com')
 * // Returns: 'https://example.com' (unchanged)
 *
 * normalizeUrl('http://example.com')
 * // Returns: 'http://example.com' (unchanged)
 * ```
 */
export function normalizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return url
  }

  const trimmedUrl = url.trim()

  // Check if URL already has a protocol
  if (hasProtocol(trimmedUrl)) {
    return trimmedUrl
  }

  // Add default protocol for URLs without explicit protocol
  return defaultProtocol + trimmedUrl
}

/**
 * Check if a URL needs normalization (missing protocol)
 *
 * @param url - URL to check
 * @returns True if URL needs normalization
 */
export function needsNormalization(url: string): boolean {
  if (typeof url !== 'string') {
    return false
  }
  return !hasProtocol(url.trim())
}

/**
 * Validate a URL, normalizing it first if needed
 *
 * Combines normalization and validation in one step.
 *
 * @param url - The URL to validate (may lack protocol)
 * @returns Validation result with normalized URL
 *
 * @example
 * ```typescript
 * validateAndNormalize('example.com')
 * // Returns: { valid: true, normalizedUrl: 'https://example.com' }
 *
 * validateAndNormalize('localhost')
 * // Returns: { valid: false, error: 'invalid_domain', normalizedUrl: 'https://localhost' }
 * ```
 */
export function validateAndNormalize(url: string): ValidationResult & { normalizedUrl?: string } {
  const normalizedUrl = normalizeUrl(url)
  const result = validateUrl(normalizedUrl)

  return {
    ...result,
    normalizedUrl,
  }
}

/**
 * Get the default protocol used for normalization
 *
 * @returns The default protocol (e.g., 'https://')
 */
export function getDefaultProtocol(): string {
  return defaultProtocol
}

/**
 * Set the default protocol used for normalization
 *
 * @param protocol - The protocol to use (must end with '://')
 * @throws Error if protocol format is invalid
 *
 * @example
 * ```typescript
 * setDefaultProtocol('http://') // Use HTTP by default
 * ```
 */
export function setDefaultProtocol(protocol: string): void {
  if (typeof protocol !== 'string' || !protocol.endsWith('://')) {
    throw new Error('Protocol must be a string ending with "://"')
  }
  defaultProtocol = protocol
}

/**
 * Get list of allowed protocols
 *
 * @returns Array of allowed protocols (e.g., ['http:', 'https:'])
 */
export function getAllowedProtocols(): string[] {
  return [...ALLOWED_PROTOCOLS]
}

/**
 * Check if a protocol is allowed
 *
 * @param protocol - Protocol to check (e.g., 'https:')
 * @returns True if protocol is allowed
 */
export function isProtocolAllowed(protocol: string): boolean {
  return ALLOWED_PROTOCOLS.includes(protocol)
}

/**
 * Get the human-readable error message for a validation error
 *
 * @param error - The validation error type
 * @returns Human-readable error message
 */
export function getErrorMessage(error: ValidationError): string {
  return ERROR_MESSAGES[error] || 'Unknown validation error'
}
