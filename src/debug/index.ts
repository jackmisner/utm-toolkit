/**
 * Debug Utilities
 *
 * Provides debugging tools for UTM tracking troubleshooting.
 * These utilities help developers understand the current state
 * of UTM tracking in their application.
 */

import type { DiagnosticInfo, ResolvedUtmConfig } from '../types';
import { captureUtmParameters } from '../core/capture';
import { getStoredUtmParameters, isSessionStorageAvailable, getRawStoredValue } from '../core/storage';
import { getDefaultConfig } from '../config/defaults';

/**
 * Get comprehensive diagnostic information about UTM tracking state
 *
 * @param config - Optional resolved config (uses defaults if not provided)
 * @returns Diagnostic information object
 *
 * @example
 * ```typescript
 * const diagnostics = getDiagnostics();
 * console.log('UTM enabled:', diagnostics.enabled);
 * console.log('Stored params:', diagnostics.storedParams);
 * ```
 */
export function getDiagnostics(config?: ResolvedUtmConfig): DiagnosticInfo {
  const resolvedConfig = config || getDefaultConfig();

  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  const currentUrl = isBrowser ? window.location.href : '';

  // Capture params from current URL
  const urlParams = isBrowser
    ? captureUtmParameters(currentUrl, {
        keyFormat: resolvedConfig.keyFormat,
        allowedParameters: resolvedConfig.allowedParameters,
      })
    : {};

  // Get stored params
  const storedParams = getStoredUtmParameters({
    storageKey: resolvedConfig.storageKey,
    keyFormat: resolvedConfig.keyFormat,
  });

  return {
    enabled: resolvedConfig.enabled,
    config: resolvedConfig,
    currentUrl,
    urlParams,
    storedParams,
    storageKey: resolvedConfig.storageKey,
    storageAvailable: isSessionStorageAvailable(),
  };
}

/**
 * Log UTM tracking state to the console in a formatted way
 *
 * @param config - Optional resolved config
 *
 * @example
 * ```typescript
 * // In browser console
 * debugUtmState();
 * ```
 */
export function debugUtmState(config?: ResolvedUtmConfig): void {
  const diagnostics = getDiagnostics(config);

  console.group('📊 UTM Toolkit Debug Info');
  console.log('Enabled:', diagnostics.enabled);
  console.log('Key Format:', diagnostics.config.keyFormat);
  console.log('Storage Key:', diagnostics.storageKey);
  console.log('Storage Available:', diagnostics.storageAvailable);
  console.log('Current URL:', diagnostics.currentUrl);

  console.group('URL Parameters');
  if (Object.keys(diagnostics.urlParams).length > 0) {
    console.table(diagnostics.urlParams);
  } else {
    console.log('(none)');
  }
  console.groupEnd();

  console.group('Stored Parameters');
  if (diagnostics.storedParams && Object.keys(diagnostics.storedParams).length > 0) {
    console.table(diagnostics.storedParams);
  } else {
    console.log('(none)');
  }
  console.groupEnd();

  console.group('Configuration');
  console.log('Capture On Mount:', diagnostics.config.captureOnMount);
  console.log('Append To Shares:', diagnostics.config.appendToShares);
  console.log('Allowed Parameters:', diagnostics.config.allowedParameters);
  console.log('Exclude From Shares:', diagnostics.config.excludeFromShares);
  console.log('Default Params:', diagnostics.config.defaultParams);
  console.log('Share Context Params:', diagnostics.config.shareContextParams);
  console.groupEnd();

  console.groupEnd();
}

/**
 * Check UTM tracking and return a summary of any issues
 *
 * @param config - Optional resolved config
 * @returns Array of warning/info messages
 *
 * @example
 * ```typescript
 * const issues = checkUtmTracking();
 * if (issues.length > 0) {
 *   issues.forEach(issue => console.warn(issue));
 * }
 * ```
 */
export function checkUtmTracking(config?: ResolvedUtmConfig): string[] {
  const messages: string[] = [];
  const diagnostics = getDiagnostics(config);

  if (!diagnostics.enabled) {
    messages.push('⚠️ UTM tracking is disabled in configuration');
    return messages;
  }

  if (!diagnostics.storageAvailable) {
    messages.push('⚠️ sessionStorage is not available (private browsing or SSR?)');
  }

  const urlParamCount = Object.keys(diagnostics.urlParams).length;
  const storedParamCount = diagnostics.storedParams
    ? Object.keys(diagnostics.storedParams).length
    : 0;

  if (urlParamCount > 0) {
    messages.push(`✅ Found ${urlParamCount} UTM parameter(s) in current URL`);
  } else {
    messages.push('ℹ️ No UTM parameters in current URL');
  }

  if (storedParamCount > 0) {
    messages.push(`✅ Found ${storedParamCount} UTM parameter(s) in storage`);
  } else {
    messages.push('ℹ️ No UTM parameters in storage');
  }

  // Check for mismatched params (in URL but not stored)
  if (urlParamCount > 0 && storedParamCount === 0 && diagnostics.config.captureOnMount) {
    messages.push(
      '⚠️ UTM params in URL but not stored. Hook may not have initialized yet.'
    );
  }

  return messages;
}

/**
 * Install debug helpers on the window object for browser console access
 *
 * Only installs if running in a browser and either:
 * - In development mode (import.meta.env.DEV)
 * - URL contains ?debug_utm=true
 *
 * @example
 * ```typescript
 * // In your app initialization
 * installDebugHelpers();
 *
 * // Then in browser console:
 * window.utmDebug.state();
 * window.utmDebug.check();
 * window.utmDebug.diagnostics();
 * window.utmDebug.raw();
 * ```
 */
export function installDebugHelpers(config?: ResolvedUtmConfig): void {
  // Only install in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  // Check if debug mode is enabled via URL parameter
  // Note: We don't check process.env here as it's not always available in browsers
  // Users can enable debug mode by adding ?debug_utm=true to the URL
  const urlParams = new URLSearchParams(window.location.search);
  const debugEnabled = urlParams.get('debug_utm') === 'true';

  if (!debugEnabled) {
    return;
  }

  // Install debug helpers on window
  const helpers = {
    /** Log current UTM state */
    state: () => debugUtmState(config),

    /** Check for issues and log messages */
    check: () => {
      const messages = checkUtmTracking(config);
      messages.forEach((msg) => console.log(msg));
      return messages;
    },

    /** Get diagnostic info as object */
    diagnostics: () => getDiagnostics(config),

    /** Get raw storage value */
    raw: (storageKey?: string) => {
      const key = storageKey || config?.storageKey || 'utm_parameters';
      const raw = getRawStoredValue(key);
      console.log(`Raw storage value for "${key}":`, raw);
      return raw;
    },
  };

  // Attach to window
  (window as unknown as Record<string, unknown>).utmDebug = helpers;

  console.log(
    '🔧 UTM debug helpers installed. Use window.utmDebug.state(), .check(), .diagnostics(), or .raw()'
  );
}
