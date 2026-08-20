# @jackmisner/utm-toolkit

[![CI](https://github.com/jackmisner/utm-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/jackmisner/utm-toolkit/actions/workflows/ci.yml)

A comprehensive TypeScript library for capturing, storing, and appending UTM tracking parameters. Framework-agnostic core with optional React integration.

## Features

### Inbound (Receiving UTM-tagged traffic)
- **Capture** UTM parameters from URLs
- **Sanitize** parameter values to prevent XSS and injection
- **PII filtering** to detect and reject/redact email addresses, phone numbers, and other PII
- **Store** in sessionStorage or localStorage (with optional TTL)
- **Attribution** — first-touch, last-touch, or both
- **Form population** — inject UTM data into HTML forms (vanilla JS + React)
- **Rejection reporting** — tell "no campaign" apart from "campaign rejected"
- **Case folding** — normalize `LinkedIn` and `linkedin` to one campaign

### Outbound (Creating UTM-tagged links)
- **Append** UTM parameters to share URLs
- **Build** UTM-tagged URLs with validation and warnings
- **Link decoration** — auto-append UTM params to links on a page (vanilla JS + React)

### General
- **Event callbacks** — lifecycle hooks for capture, store, clear, append, and expiry events
- **Configurable** key format (snake_case or camelCase)
- **Platform-specific** share context parameters
- **Fragment mode** support (add params to `#hash` instead of `?query`)
- **URL validation** and normalization
- **React hook** and context provider
- **Debug utilities** for troubleshooting
- **SSR-safe** with graceful fallbacks
- **Server entry** (`/server`) — DOM-free normalization for public ingest endpoints
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

// With sanitization (strips HTML, control chars)
const params = captureUtmParameters(url, {
  sanitize: {
    enabled: true,
    stripHtml: true,        // Remove < > " ' ` (default: true)
    stripControlChars: true, // Remove control characters (default: true)
    maxLength: 200,          // Truncate values (default: 200)
  },
});
```

#### `storeUtmParameters(params, options?)`

Store UTM parameters in browser storage.

```typescript
storeUtmParameters({ utm_source: 'linkedin', utm_campaign: 'sale' });

// With custom storage key
storeUtmParameters(params, { storageKey: 'myapp_utm' });

// Store in localStorage (persists across sessions)
storeUtmParameters(params, { storageType: 'local' });

// Store in localStorage with 1-hour TTL
storeUtmParameters(params, { storageType: 'local', ttl: 3600000 });

// Store in camelCase format
storeUtmParameters(params, { keyFormat: 'camelCase' });
```

#### `getStoredUtmParameters(options?)`

Retrieve stored UTM parameters. Returns null if data has expired (when TTL was set).

```typescript
const params = getStoredUtmParameters();

// Read from localStorage
const params = getStoredUtmParameters({ storageType: 'local' });

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

#### `clearStoredUtmParameters(options?)`

Clear stored UTM parameters.

```typescript
clearStoredUtmParameters();
clearStoredUtmParameters({ storageKey: 'myapp_utm' });
clearStoredUtmParameters({ storageType: 'local' });
clearStoredUtmParameters({ onClear: () => console.log('Cleared!') });

// Legacy positional args still work
clearStoredUtmParameters('myapp_utm');
clearStoredUtmParameters('utm_parameters', 'local');
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

### Value Sanitization

Sanitize UTM parameter values to prevent XSS when rendering in HTML or constructing URLs. Sanitization is disabled by default and runs at capture time only.

```typescript
import { captureUtmParameters, sanitizeValue, sanitizeParams } from '@jackmisner/utm-toolkit';

// Enable sanitization during capture
const params = captureUtmParameters('https://example.com?utm_source=<script>bad</script>', {
  sanitize: { enabled: true },
});
// { utm_source: 'scriptbad/script' }

// Use standalone sanitization functions
sanitizeValue('<b>bold</b>', {
  enabled: true,
  stripHtml: true,
  stripControlChars: true,
  maxLength: 200,
});
// 'bbold/b'

// With a custom pattern
const params = captureUtmParameters(url, {
  sanitize: {
    enabled: true,
    customPattern: /[!@#$%^&*]/g, // Strip additional characters
  },
});
```

#### Dropping instead of truncating

By default an over-length value is truncated to `maxLength`. Truncation invents a value nobody sent, and two campaigns sharing a long prefix collapse into one. Set `onMaxLength: 'drop'` when values key a datastore — an absent parameter is honest, a fabricated one is not.

```typescript
captureUtmParameters(url, {
  sanitize: { enabled: true, maxLength: 64, onMaxLength: 'drop' },
});
// An over-length utm_source becomes '' rather than its first 64 characters
```

#### Gating values with `valuePattern`

`valuePattern` is a positive allowlist: a value that does not match becomes `''`. Note how it differs from the two adjacent regex options:

| Option | Effect |
|--------|--------|
| `sanitize.customPattern` | **Subtractive** — strips every match from the value |
| `sanitize.valuePattern` | **A gate** — keeps the value intact, or drops it whole |
| `piiFiltering.allowlistPattern` | The same gate, scoped to PII decisions, and able to produce `'[REDACTED]'` in redact mode |

```typescript
captureUtmParameters(url, {
  sanitize: { enabled: true, valuePattern: /^[a-z0-9_-]+$/ },
});
// 'spring-2025' survives; 'has spaces!' becomes ''
```

The gate is tested against the *trimmed* value, so surrounding whitespace never causes a rejection on its own.

#### Folding case with `lowercaseValues`

`LinkedIn` and `linkedin` are the same campaign. Anyone keying a store on captured values gets two rows unless the values are folded. `lowercaseValues` is the inbound counterpart of `buildUtmUrl`'s option of the same name:

```typescript
captureUtmParameters('https://example.com?utm_source=LinkedIn', {
  lowercaseValues: true,
});
// { utm_source: 'linkedin' }
```

Folding runs **before** sanitization and PII filtering, so `customPattern`, `valuePattern` and `piiFiltering.allowlistPattern` all see the folded value and can be written without allowing uppercase. Keys are never folded, only values. It uses `toLowerCase()` rather than `toLocaleLowerCase()`, so the result does not depend on the host locale.

### PII Filtering

Detect and filter personally identifiable information (email addresses, phone numbers) from UTM parameter values. Prevents PII from leaking into analytics via misconfigured tracking links. Disabled by default.

```typescript
import { captureUtmParameters } from '@jackmisner/utm-toolkit';

// Reject mode (default) — discard values containing PII
const params = captureUtmParameters('https://example.com?utm_source=john@example.com&utm_medium=cpc', {
  piiFiltering: { enabled: true },
});
// { utm_medium: 'cpc' } — utm_source was rejected

// Redact mode — replace PII values with [REDACTED]
const params = captureUtmParameters('https://example.com?utm_source=john@example.com&utm_medium=cpc', {
  piiFiltering: { enabled: true, mode: 'redact' },
});
// { utm_source: '[REDACTED]', utm_medium: 'cpc' }

// Strict allowlist — only accept values matching a pattern
const params = captureUtmParameters(url, {
  piiFiltering: {
    enabled: true,
    allowlistPattern: /^[a-z0-9_-]+$/, // Only lowercase alphanumeric, hyphens, underscores
  },
});

// Callback for logging PII detections
const params = captureUtmParameters(url, {
  piiFiltering: {
    enabled: true,
    onPiiDetected: (param, value, patternName) => {
      console.warn(`PII detected in ${param}: matched ${patternName}`);
    },
  },
});
```

Built-in PII patterns detect: email addresses, international phone numbers, UK phone numbers, and US phone numbers.

### Telling "No Campaign" Apart From "Campaign Rejected"

`captureUtmParameters` returns `{}` for two completely different situations: genuine direct traffic, and a campaign link whose every parameter was filtered. Collapsing them inflates the direct-traffic denominator that every campaign share is measured against.

`captureUtmParametersWithReport` separates them:

```typescript
import { captureUtmParametersWithReport } from '@jackmisner/utm-toolkit';

const { params, rejected, invalidUrl } = captureUtmParametersWithReport(url, {
  piiFiltering: { enabled: true },
});

if (invalidUrl) {
  // The URL could not be parsed at all — neither direct traffic nor a campaign
} else if (Object.keys(params).length === 0 && rejected.length > 0) {
  // A campaign link arrived and every parameter was filtered.
  // This is NOT direct traffic.
  console.warn('rejected:', rejected);
  // [{ key: 'utm_source', reason: 'pii', patternName: 'email' }]
}
```

Rejection reasons are `'allowedParameters'`, `'valuePattern'`, `'maxLength'`, `'allowlist'`, `'pii'` and `'notAString'` (server-side only). Rejections are recorded per parameter, so one bad parameter never costs you the whole campaign.

> **The report deliberately omits the rejected value.** It carries the key, the reason, and for PII the matching pattern name — nothing else. A report struct containing the raw value would be handed straight to a logger by most consumers, which is exactly what PII filtering exists to prevent.

`captureUtmParameters` delegates to this function and returns `.params`, so the two can never drift apart.

### Sending Captured Params to a Server

If you POST captured parameters to your own endpoint, there is a trap in `navigator.sendBeacon` worth knowing about before you hit it.

**`sendBeacon` does not send JSON.** `navigator.sendBeacon(url, JSON.stringify(params))` sends `Content-Type: text/plain;charset=UTF-8`. A server that only parses `application/json` receives the body as a raw string, JSON parsing fails, and — if the server is written defensively — the campaign silently becomes empty while the endpoint still answers `204`. There is no error anywhere, and every campaign is attributed to direct traffic.

Wrapping the body in a `Blob` typed `application/json` does not fix it. That makes the request non-simple, `sendBeacon` cannot perform the CORS preflight, and the browser drops the request entirely — also silently.

There are two workable options, and the tradeoff is real:

```typescript
// Option 1 — fetch with keepalive. Sends real JSON, survives page unload,
// but is subject to CORS preflight and a ~64KB keepalive body limit.
fetch('/api/utm', {
  method: 'POST',
  keepalive: true,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(params),
});

// Option 2 — sendBeacon, and a server that accepts text/plain.
navigator.sendBeacon('/api/utm', JSON.stringify(params));
```

If you choose option 2, the server has to opt into the content type it will actually receive:

```typescript
// Fastify — register text/plain and parse it as JSON
fastify.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
  try {
    done(null, JSON.parse(body as string));
  } catch {
    done(null, {}); // Never throw on an untrusted body
  }
});

// Express
app.use(express.text({ type: 'text/plain' }));
```

Either way, normalize what arrives — see [Server-Side Usage](#server-side-usage) below. The client-side pass cannot be trusted for a public endpoint, because anyone can POST to it directly.

### Event Callbacks

Hook into UTM lifecycle events for logging, analytics, or custom behavior.

```typescript
import {
  captureUtmParameters,
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
  appendUtmParameters,
} from '@jackmisner/utm-toolkit';

// onCapture — fired after UTM params are captured from a URL
captureUtmParameters(url, {
  onCapture: (params) => console.log('Captured:', params),
});

// onStore — fired after params are written to storage
storeUtmParameters(params, {
  onStore: (params, meta) => console.log(`Stored (${meta.storageType}):`, params),
});

// onClear — fired when stored params are cleared
clearStoredUtmParameters({
  onClear: () => analytics.track('utm_params_cleared'),
});

// onAppend — fired after UTM params are appended to a URL
appendUtmParameters(url, params, {
  onAppend: (finalUrl, params) => console.log('Appended:', finalUrl),
});

// onExpire — fired when TTL-expired data is auto-cleaned
getStoredUtmParameters({
  storageType: 'local',
  onExpire: (storageKey) => console.log(`Expired: ${storageKey}`),
});
```

All callbacks are wrapped in try-catch — a throwing callback will never break the main pipeline.

### First-Touch / Last-Touch Attribution

Track how users first discovered your site vs. their most recent visit.

```typescript
import { storeWithAttribution, getAttributedParams } from '@jackmisner/utm-toolkit';

// Mode: 'last' (default) — stores to main key, same as storeUtmParameters
storeWithAttribution(params, {
  attribution: { mode: 'last' },
  storageKey: 'utm_parameters',
  storageType: 'session',
  keyFormat: 'snake_case',
});

// Mode: 'first' — write-once; only stores on the first visit
storeWithAttribution(params, {
  attribution: { mode: 'first' },
  storageKey: 'utm_parameters',
  storageType: 'session',
  keyFormat: 'snake_case',
});

// Mode: 'both' — stores first-touch (write-once) and last-touch (always updates)
storeWithAttribution(params, {
  attribution: { mode: 'both', firstTouchSuffix: '_first', lastTouchSuffix: '_last' },
  storageKey: 'utm_parameters',
  storageType: 'session',
  keyFormat: 'snake_case',
});

// Read attributed params
const first = getAttributedParams({ ...opts, touch: 'first' });
const last = getAttributedParams({ ...opts, touch: 'last' });
```

#### Attribution with React

```tsx
const {
  utmParameters,       // Current params (based on attribution mode)
  firstTouchParams,    // First-touch params (null when mode is 'last')
  lastTouchParams,     // Last-touch params (null when mode is 'first')
} = useUtmTracking({
  config: { attribution: { mode: 'both' } },
});
```

### UTM Link Builder

Build UTM-tagged URLs from structured input with validation and warnings.

```typescript
import { buildUtmUrl, validateUtmValues } from '@jackmisner/utm-toolkit';

const result = buildUtmUrl({
  url: 'https://example.com',
  source: 'google',
  medium: 'cpc',
  campaign: 'spring2025',
});
// result.valid === true
// result.url === 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring2025'
// result.errors === []
// result.warnings === []

// With options
const result = buildUtmUrl(
  { url: 'example.com', source: 'Google', campaign: 'Spring' },
  { normalize: true, lowercaseValues: true },
);
// Normalizes URL, lowercases all values, no uppercase warnings

// Validation errors
const result = buildUtmUrl({ url: 'https://example.com', source: 'goo&gle' });
// result.valid === false
// result.errors === ['source contains unsafe characters (& = ? #)']

// Standalone validation
const { errors, warnings } = validateUtmValues({ source: 'Google', medium: 'cpc' });
// errors === [], warnings === ['source contains uppercase characters']
```

### Form Field Population

Inject stored UTM params into HTML form fields. Works with vanilla JS or React.

#### Vanilla JS

```typescript
import { populateFormFields, createUtmHiddenFields } from '@jackmisner/utm-toolkit';

// Strategy: 'name' — find <input name="utm_source"> etc. and set values
populateFormFields({ strategy: 'name' });

// Strategy: 'data-attribute' — find <input data-utm="source"> etc.
populateFormFields({ strategy: 'data-attribute' });

// Strategy: 'auto-create' (default) — create hidden inputs in matching forms
populateFormFields({ selector: '#signup-form' });

// createUtmHiddenFields is a shortcut for auto-create strategy
createUtmHiddenFields({ selector: 'form.track-utm' });
```

#### React

```tsx
import { UtmHiddenFields, useUtmFormData } from '@jackmisner/utm-toolkit/react';

// Component — renders hidden <input> elements inside your form
function ContactForm() {
  return (
    <form action="/submit">
      <input name="email" type="email" />
      <UtmHiddenFields prefix="tracking_" />
      <button type="submit">Submit</button>
    </form>
  );
}

// Hook — returns UTM data as a flat Record for form libraries
function MyForm() {
  const utmData = useUtmFormData();
  // { utm_source: 'google', utm_medium: 'cpc', ... }

  return (
    <form>
      {Object.entries(utmData).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
    </form>
  );
}
```

### Automatic Link Decoration

Auto-append UTM params to links on a page. Useful for internal navigation tracking.

#### Vanilla JS

```typescript
import { decorateLinks, observeAndDecorateLinks } from '@jackmisner/utm-toolkit';

// Decorate all internal links
decorateLinks();

// With options
decorateLinks({
  selector: 'a.track',            // Custom CSS selector
  internalOnly: true,              // Only same-host links (default)
  includeHosts: ['partner.com'],   // Additional hosts to decorate
  excludeHosts: ['cdn.example.com'], // Hosts to skip
  skipExisting: true,              // Don't re-decorate (default)
  extraParams: { utm_campaign: 'nav' }, // Additional static params
  onAppend: (url, params) => console.log('Decorated:', url),
});

// For SPAs — watch for new links via MutationObserver
const cleanup = observeAndDecorateLinks({ internalOnly: false });
// Later: cleanup() to disconnect the observer
```

#### React

```tsx
import { UtmLinkDecorator, useUtmLinkDecorator } from '@jackmisner/utm-toolkit/react';

// Component wrapper — decorates child links
function Navigation() {
  return (
    <UtmLinkDecorator internalOnly={true}>
      <nav>
        <a href="/products">Products</a>
        <a href="/pricing">Pricing</a>
      </nav>
    </UtmLinkDecorator>
  );
}

// Hook — returns a ref to scope decoration to a container
function MySection() {
  const ref = useUtmLinkDecorator({ internalOnly: false });
  return (
    <div ref={ref}>
      <a href="https://partner.com">Partner Link</a>
    </div>
  );
}
```

### Persistent Storage

By default, UTM parameters are stored in `sessionStorage` (cleared when the tab closes). For longer-lived storage, use `localStorage` with an optional TTL.

```typescript
import { storeUtmParameters, getStoredUtmParameters, createConfig } from '@jackmisner/utm-toolkit';

// Ephemeral storage (default) — cleared when tab closes
storeUtmParameters(params);

// Persistent storage — survives browser restarts
storeUtmParameters(params, { storageType: 'local' });

// Persistent storage with 24-hour TTL — auto-expires
storeUtmParameters(params, { storageType: 'local', ttl: 86400000 });

// Expired data returns null and is auto-cleaned from storage
const stored = getStoredUtmParameters({ storageType: 'local' });

// Use with React hook
const { utmParameters } = useUtmTracking({
  config: {
    storageType: 'local',
    ttl: 86400000, // 24 hours
  },
});
```

### Configuration

```typescript
import { createConfig } from '@jackmisner/utm-toolkit';

const config = createConfig({
  enabled: true,
  keyFormat: 'snake_case',
  storageKey: 'utm_parameters',
  storageType: 'session',
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
    utmParameters,       // Current captured params (or null)
    isEnabled,           // Whether tracking is enabled
    hasParams,           // Whether any params exist
    capture,             // Manually capture from URL
    clear,               // Clear stored params
    appendToUrl,         // Append params to a URL
    firstTouchParams,    // First-touch params (null when attribution mode is 'last')
    lastTouchParams,     // Last-touch params (null when attribution mode is 'first')
  } = useUtmTracking({
    config: {
      keyFormat: 'camelCase',
      attribution: { mode: 'both' },
      shareContextParams: {
        linkedin: { utm_content: 'linkedin' },
      },
      onCapture: (params) => analytics.track('utm_captured', params),
      onStore: (params, meta) => analytics.track('utm_stored', { ...params, touch: meta.touch }),
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

## Server-Side Usage

`@jackmisner/utm-toolkit/server` is a DOM-free entry point for applying the same folding rules server-side. It exists because **the client-side pass cannot be trusted for a public endpoint** — anyone can POST to it directly.

```typescript
import { normalizeUtmParams } from '@jackmisner/utm-toolkit/server';

app.post('/api/utm', (req, res) => {
  const { params, rejected } = normalizeUtmParams(req.body);

  // params is TOTAL: every allowed key is present, absent ones are ''
  // { utm_source: 'linkedin', utm_medium: '', utm_campaign: '', ... }
  await db.insertCampaignHit(params);

  if (rejected.length > 0) metrics.increment('utm.rejected', rejected.length);
  res.status(204).end();
});
```

For a server that has a URL rather than a parsed body — a `Referer` header, a redirect target — use `normalizeUtmUrl(url, options)`. It has the same contract.

### Why the output is total

Every key in `allowedParameters` is always present, with absent parameters set to `absentValue` (default `''`). If you write these into a composite primary key, absence has to be a value that **groups**: `NULL` does not deduplicate in most stores, so a nullable column fragments one campaign into as many rows as it has absent parameters. Set `absentValue` to something unforgeable if `''` could collide with a real campaign value.

### It never throws

The argument is an untrusted HTTP body, so a throw is a 500 on somebody's first page load. `null`, `42`, `'a string'`, `[]`, `{ utm_source: ['a','b'] }` and a body with a `__proto__` key all produce a usable total result. Non-string values are **rejected rather than coerced** — `String(['a','b'])` is `'a,b'`, a value nobody sent.

### Server defaults differ from browser defaults, deliberately

| Option | Server default | Browser default | Why |
|--------|----------------|-----------------|-----|
| `lowercase` | `true` | `false` | `LinkedIn` and `linkedin` are one campaign |
| `onMaxLength` | `'drop'` | `'truncate'` | A truncated value is one nobody sent |
| `piiFiltering` | enabled | disabled | The endpoint is public |
| `allowedParameters` | all six standard params, **including `utm_id`** | same | Narrow it if you key fewer columns |

The browser defaults are lenient because losing a campaign label client-side is cheap. A server keying a datastore needs determinism.

`piiFiltering.mode` is deliberately **not** configurable here. `'[REDACTED]'` persisted as a campaign value is a campaign nobody ran, which is worse than dropping it; server-side filtering always rejects.

> **On `utm_id`:** the server defaults to all six standard parameters, matching the browser. If your table keys five columns, pass `allowedParameters` explicitly — a consumer keying five against a library producing six gets a mystery extra row.

### What this entry point cannot reach

`/server` does not import storage, form population, link decoration, debug helpers or React. That restriction is enforced by a test that walks the module's runtime import graph, not just documented — so the guarantee cannot be quietly removed by a convenient re-export.

Note the honest framing: the root entry does **not** crash in Node. The reasons to use `/server` are the documented DOM-free surface, the server-appropriate defaults, the totality contract, and a smaller install/parse surface — the server bundle is roughly 8KB against the root entry's 52KB.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable UTM tracking |
| `keyFormat` | `'snake_case' \| 'camelCase'` | `'snake_case'` | Key format for returned params |
| `storageKey` | `string` | `'utm_parameters'` | Browser storage key |
| `storageType` | `'session' \| 'local'` | `'session'` | Storage backend (sessionStorage or localStorage) |
| `ttl` | `number` | `undefined` | Time-to-live in ms for stored params (localStorage only) |
| `captureOnMount` | `boolean` | `true` | Auto-capture on React hook mount |
| `appendToShares` | `boolean` | `true` | Append UTM params to share URLs |
| `allowedParameters` | `string[]` | Standard UTM params | Params to capture |
| `lowercaseValues` | `boolean` | `false` | Fold captured values to lowercase (runs before sanitize and PII gates) |
| `defaultParams` | `object` | `{}` | Fallback params when none captured |
| `shareContextParams` | `object` | `{}` | Platform-specific params |
| `excludeFromShares` | `string[]` | `[]` | Params to exclude from shares |
| `sanitize` | `SanitizeConfig` | `{ enabled: false }` | Value sanitization settings |
| `piiFiltering` | `PiiFilterConfig` | `{ enabled: false }` | PII detection and filtering |
| `attribution` | `AttributionConfig` | `{ mode: 'last' }` | First-touch/last-touch attribution |
| `onCapture` | `function` | `undefined` | Callback after UTM params are captured |
| `onStore` | `function` | `undefined` | Callback after UTM params are stored |
| `onClear` | `function` | `undefined` | Callback when stored params are cleared |
| `onAppend` | `function` | `undefined` | Callback after UTM params are appended to a URL |
| `onExpire` | `function` | `undefined` | Callback when stored params expire (TTL) |

### `SanitizeConfig`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable sanitization |
| `stripHtml` | `boolean` | `true` | Strip HTML-significant characters: `<` `>` `"` `'` and backtick |
| `stripControlChars` | `boolean` | `true` | Strip control characters except tab/newline/CR |
| `maxLength` | `number` | `200` | Maximum value length |
| `onMaxLength` | `'truncate' \| 'drop'` | `'truncate'` | Truncate an over-length value, or drop it to `''` |
| `customPattern` | `RegExp` | `undefined` | **Subtractive** — strips every match from the value |
| `valuePattern` | `RegExp` | `undefined` | **A gate** — keeps the value whole, or drops it to `''` |

Rules apply in order: `stripHtml` → `stripControlChars` → `customPattern` → trim → `valuePattern` → `maxLength`.

## TypeScript Types

```typescript
import type {
  UtmParameters,
  UtmConfig,
  StorageType,
  KeyFormat,
  SanitizeConfig,
  PiiFilterConfig,
  PiiPattern,
  SharePlatform,
  AttributionMode,
  AttributionConfig,
  TouchType,
  ValidationResult,
  UseUtmTrackingReturn,
} from '@jackmisner/utm-toolkit';
```

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Requires `sessionStorage` or `localStorage` support
- SSR-safe (returns empty/null values on server)

## Migration from Existing Projects

If you're migrating from a custom UTM implementation:

1. Install the package
2. Replace custom capture/storage/append functions with the library equivalents
3. Update storage key if needed via `storageKey` option
4. Test that existing UTM tracking still works

## License

MIT
