/**
 * Key format options for UTM parameters
 * - 'snake_case': URL-style format (utm_source, utm_campaign)
 * - 'camelCase': TypeScript-style format (utmSource, utmCampaign)
 */
export type KeyFormat = 'snake_case' | 'camelCase';

/**
 * Standard UTM parameter keys in snake_case (URL format)
 */
export type StandardSnakeCaseUtmKey =
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'utm_term'
  | 'utm_content'
  | 'utm_id';

/**
 * Any UTM key in snake_case format (includes custom params like utm_team_id)
 */
export type SnakeCaseUtmKey = StandardSnakeCaseUtmKey | `utm_${string}`;

/**
 * Standard UTM parameter keys in camelCase (TypeScript format)
 */
export type StandardCamelCaseUtmKey =
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'utmTerm'
  | 'utmContent'
  | 'utmId';

/**
 * UTM parameters object using snake_case keys (URL format)
 */
export interface UtmParametersSnake {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
  [key: `utm_${string}`]: string | undefined;
}

/**
 * UTM parameters object using camelCase keys (TypeScript format)
 */
export interface UtmParametersCamel {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  utmId?: string;
  [key: string]: string | undefined;
}

/**
 * Union type for UTM parameters - can be either format
 */
export type UtmParameters = UtmParametersSnake | UtmParametersCamel;

/**
 * Platform identifiers for share context configuration
 */
export type SharePlatform = 'linkedin' | 'twitter' | 'facebook' | 'copy' | string;

/**
 * Platform-specific UTM parameter overrides for sharing
 * - `default`: Applied to all shares as base
 * - Platform keys (linkedin, twitter, etc.): Override specific parameters per platform
 */
export type ShareContextParams = Partial<Record<SharePlatform, UtmParameters>> & {
  default?: UtmParameters;
};

/**
 * Options for appending UTM parameters to URLs
 */
export interface AppendOptions {
  /** Add parameters to URL fragment (#) instead of query string (?) */
  toFragment?: boolean;
  /** Keep existing UTM parameters instead of replacing them */
  preserveExisting?: boolean;
}

/**
 * Result of URL validation
 */
export interface ValidationResult {
  /** Whether the URL is valid */
  valid: boolean;
  /** Error identifier if invalid */
  error?: ValidationError;
  /** Human-readable error message */
  message?: string;
}

/**
 * Validation error types
 */
export type ValidationError =
  | 'invalid_protocol'
  | 'invalid_domain'
  | 'malformed_url'
  | 'empty_url';

/**
 * Main configuration interface for UTM toolkit
 */
export interface UtmConfig {
  /** Enable/disable UTM tracking entirely (default: true) */
  enabled?: boolean;

  /** Key format for returned UTM parameters (default: 'snake_case') */
  keyFormat?: KeyFormat;

  /** Storage key prefix for sessionStorage (default: 'utm_parameters') */
  storageKey?: string;

  /** Auto-capture UTM params on React hook mount (default: true) */
  captureOnMount?: boolean;

  /** Auto-append UTM params when generating share URLs (default: true) */
  appendToShares?: boolean;

  /**
   * Allowlist of UTM parameters to capture (snake_case format)
   * Default: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id']
   */
  allowedParameters?: string[];

  /** Default UTM parameters when none are captured */
  defaultParams?: UtmParameters;

  /** Platform-specific UTM overrides for share URLs */
  shareContextParams?: ShareContextParams;

  /** Parameters to exclude when appending to share URLs (e.g., ['utm_team_id']) */
  excludeFromShares?: string[];
}

/**
 * Fully resolved configuration with all defaults applied
 */
export interface ResolvedUtmConfig {
  enabled: boolean;
  keyFormat: KeyFormat;
  storageKey: string;
  captureOnMount: boolean;
  appendToShares: boolean;
  allowedParameters: string[];
  defaultParams: UtmParameters;
  shareContextParams: ShareContextParams;
  excludeFromShares: string[];
}

/**
 * Return type for the useUtmTracking React hook
 */
export interface UseUtmTrackingReturn {
  /** Currently captured/stored UTM parameters */
  utmParameters: UtmParameters | null;

  /** Whether UTM tracking is enabled */
  isEnabled: boolean;

  /** Whether any UTM parameters exist */
  hasParams: boolean;

  /** Manually capture UTM parameters from current URL */
  capture: () => void;

  /** Clear stored UTM parameters */
  clear: () => void;

  /**
   * Append UTM parameters to a URL
   * @param url - Base URL to append parameters to
   * @param platform - Optional platform for context-specific params
   * @returns URL with UTM parameters appended
   */
  appendToUrl: (url: string, platform?: SharePlatform) => string;
}

/**
 * Props for UtmProvider component
 */
export interface UtmProviderProps {
  /** Configuration options */
  config?: Partial<UtmConfig>;

  /** Child components */
  children: React.ReactNode;
}

/**
 * Debug diagnostic information
 */
export interface DiagnosticInfo {
  /** Whether tracking is enabled */
  enabled: boolean;

  /** Current configuration */
  config: ResolvedUtmConfig;

  /** Current URL */
  currentUrl: string;

  /** UTM parameters found in current URL */
  urlParams: UtmParameters;

  /** UTM parameters in storage */
  storedParams: UtmParameters | null;

  /** Storage key being used */
  storageKey: string;

  /** Whether sessionStorage is available */
  storageAvailable: boolean;
}
