# @jackmisner/utm-toolkit

[![CI](https://github.com/jackmisner/utm-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/jackmisner/utm-toolkit/actions/workflows/ci.yml)

A comprehensive TypeScript library for capturing, storing, and appending UTM tracking parameters. Framework-agnostic core with optional React integration.

## Features

- **Capture** UTM parameters from URLs
- **Store** in sessionStorage for the browser session
- **Append** UTM parameters to share URLs
- **Configurable** key format (snake_case or camelCase)
- **Platform-specific** share context parameters
- **Fragment mode** support (add params to `#hash` instead of `?query`)
- **URL validation** and normalization
- **React hook** and context provider
- **Debug utilities** for troubleshooting
- **SSR-safe** with graceful fallbacks
- **Zero dependencies** (peer dependency on React is optional)

## Installation

```bash
npm install @jackmisner/utm-toolkit
```

## Quick Start

### Basic Usage (Framework-Agnostic)

```typescript
import {
  captureUtmParameters,
  storeUtmParameters,
  getStoredUtmParameters,
  appendUtmParameters,
} from '@jackmisner/utm-toolkit';

// Capture UTM params from URL
// URL: https://example.com?utm_source=linkedin&utm_campaign=spring2025
const params = captureUtmParameters();
// { utm_source: 'linkedin', utm_campaign: 'spring2025' }

// Store for the session
storeUtmParameters(params);

// Later, retrieve stored params
const stored = getStoredUtmParameters();

// Append to a share URL
const shareUrl = appendUtmParameters('https://example.com/share', stored);
// https://example.com/share?utm_source=linkedin&utm_campaign=spring2025
```

### React Usage

```tsx
import { useUtmTracking } from '@jackmisner/utm-toolkit/react';

function ShareButton() {
  const { appendToUrl, hasParams } = useUtmTracking();

  const handleShare = () => {
    const shareUrl = appendToUrl('https://example.com/results', 'linkedin');
    window.open(`https://linkedin.com/share?url=${encodeURIComponent(shareUrl)}`);
  };

  return <button onClick={handleShare}>Share on LinkedIn</button>;
}
```

### React with Provider (Shared State)

```tsx
import { UtmProvider, useUtmContext } from '@jackmisner/utm-toolkit/react';

// Wrap your app
function App() {
  return (
    <UtmProvider config={{ storageKey: 'myapp_utm' }}>
      <MyComponent />
    </UtmProvider>
  );
}

// Access UTM state anywhere
function MyComponent() {
  const { utmParameters, appendToUrl } = useUtmContext();
  // ...
}
```

## API Reference

### Core Functions

#### `captureUtmParameters(url?, options?)`

Extract UTM parameters from a URL.

```typescript
// Capture from current page URL
const params = captureUtmParameters();

// Capture from specific URL
const params = captureUtmParameters('https://example.com?utm_source=test');

// With options
const params = captureUtmParameters(url, {
  keyFormat: 'camelCase', // 'snake_case' (default) or 'camelCase'
  allowedParameters: ['utm_source', 'utm_campaign'], // Filter to specific params
});
```

#### `storeUtmParameters(params, options?)`

Store UTM parameters in sessionStorage.

```typescript
storeUtmParameters({ utm_source: 'linkedin', utm_campaign: 'sale' });

// With custom storage key
storeUtmParameters(params, { storageKey: 'myapp_utm' });

// Store in camelCase format
storeUtmParameters(params, { keyFormat: 'camelCase' });
```

#### `getStoredUtmParameters(options?)`

Retrieve stored UTM parameters.

```typescript
const params = getStoredUtmParameters();

// With options
const params = getStoredUtmParameters({
  storageKey: 'myapp_utm',
  keyFormat: 'camelCase', // Convert to camelCase on retrieval
});
```

#### `appendUtmParameters(url, params, options?)`

Append UTM parameters to a URL.

```typescript
// Basic usage
const url = appendUtmParameters('https://example.com', { utm_source: 'test' });

// With options
const url = appendUtmParameters(url, params, {
  toFragment: true, // Add to #hash instead of ?query
  preserveExisting: true, // Don't replace existing UTM params
});
```

#### `clearStoredUtmParameters(storageKey?)`

Clear stored UTM parameters.

```typescript
clearStoredUtmParameters();
clearStoredUtmParameters('myapp_utm'); // Custom key
```

### Key Conversion

```typescript
import {
  toSnakeCase,
  toCamelCase,
  convertParams,
} from '@jackmisner/utm-toolkit';

// Convert single keys
toSnakeCase('utmSource'); // 'utm_source'
toCamelCase('utm_source'); // 'utmSource'

// Convert entire objects
convertParams({ utmSource: 'test' }, 'snake_case');
// { utm_source: 'test' }
```

### URL Validation

```typescript
import {
  validateUrl,
  normalizeUrl,
  validateAndNormalize,
} from '@jackmisner/utm-toolkit';

// Validate URL
const result = validateUrl('https://example.com');
// { valid: true }

const result = validateUrl('ftp://example.com');
// { valid: false, error: 'invalid_protocol', message: '...' }

// Normalize URL (add protocol if missing)
normalizeUrl('example.com'); // 'https://example.com'

// Combined
validateAndNormalize('example.com');
// { valid: true, normalizedUrl: 'https://example.com' }
```

### Configuration

```typescript
import { createConfig } from '@jackmisner/utm-toolkit';

const config = createConfig({
  enabled: true,
  keyFormat: 'snake_case',
  storageKey: 'utm_parameters',
  captureOnMount: true,
  appendToShares: true,
  allowedParameters: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'],
  defaultParams: {},
  shareContextParams: {
    default: { utm_medium: 'social_share' },
    linkedin: { utm_content: 'linkedin_share' },
    copy: { utm_content: 'link_copy' },
  },
  excludeFromShares: ['utm_team_id'],
});
```

### React Hook

```typescript
import { useUtmTracking } from '@jackmisner/utm-toolkit/react';

function MyComponent() {
  const {
    utmParameters,    // Current captured params (or null)
    isEnabled,        // Whether tracking is enabled
    hasParams,        // Whether any params exist
    capture,          // Manually capture from URL
    clear,            // Clear stored params
    appendToUrl,      // Append params to a URL
  } = useUtmTracking({
    config: {
      keyFormat: 'camelCase',
      shareContextParams: {
        linkedin: { utm_content: 'linkedin' },
      },
    },
  });

  // Generate share URL with platform-specific params
  const linkedInUrl = appendToUrl('https://example.com', 'linkedin');
}
```

### Debug Utilities

```typescript
import {
  debugUtmState,
  checkUtmTracking,
  installDebugHelpers,
} from '@jackmisner/utm-toolkit';

// Log current state to console
debugUtmState();

// Check for issues
const messages = checkUtmTracking();
messages.forEach(msg => console.log(msg));

// Install browser console helpers (add ?debug_utm=true to URL)
installDebugHelpers();
// Then use: window.utmDebug.state(), window.utmDebug.check()
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable UTM tracking |
| `keyFormat` | `'snake_case' \| 'camelCase'` | `'snake_case'` | Key format for returned params |
| `storageKey` | `string` | `'utm_parameters'` | sessionStorage key |
| `captureOnMount` | `boolean` | `true` | Auto-capture on React hook mount |
| `appendToShares` | `boolean` | `true` | Append UTM params to share URLs |
| `allowedParameters` | `string[]` | Standard UTM params | Params to capture |
| `defaultParams` | `object` | `{}` | Fallback params when none captured |
| `shareContextParams` | `object` | `{}` | Platform-specific params |
| `excludeFromShares` | `string[]` | `[]` | Params to exclude from shares |

## TypeScript Types

```typescript
import type {
  UtmParameters,
  UtmConfig,
  SharePlatform,
  UseUtmTrackingReturn,
} from '@jackmisner/utm-toolkit';
```

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Requires `sessionStorage` support
- SSR-safe (returns empty/null values on server)

## Migration from Existing Projects

If you're migrating from a custom UTM implementation:

1. Install the package
2. Replace custom capture/storage/append functions with the library equivalents
3. Update storage key if needed via `storageKey` option
4. Test that existing UTM tracking still works

## License

MIT
