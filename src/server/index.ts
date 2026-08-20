/**
 * @jackmisner/utm-toolkit/server
 *
 * DOM-free UTM normalisation for server-side ingest endpoints.
 *
 * This entry point must not reach browser-coupled code. It deliberately does
 * NOT import from `common/storage`, `inbound/form`, `outbound/decorator`,
 * `debug/` or `react/` — that import restriction is the structural guarantee
 * that this module cannot touch storage or the DOM, and it is enforced by a
 * test in `__tests__/server/isolation.test.ts`.
 *
 * @packageDocumentation
 */

export {
  normalizeUtmParams,
  normalizeUtmUrl,
  type ServerNormalizeOptions,
  type ServerNormalizeResult,
} from './normalize'

export type { UtmRejection, UtmRejectionReason } from '../inbound/capture-report'

export { STANDARD_UTM_PARAMETERS } from '../config/defaults'
