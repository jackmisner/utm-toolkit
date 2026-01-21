/**
 * UTM Provider Component
 *
 * React context provider for sharing UTM tracking state across the component tree.
 * Use this when you need to access UTM state from multiple components without
 * prop drilling.
 */

import React, { createContext, useContext, useMemo } from 'react'
import type { UtmConfig, UtmProviderProps, UseUtmTrackingReturn } from '../types'
import { useUtmTracking } from './useUtmTracking'

/**
 * Context for UTM tracking state
 * @internal
 */
const UtmContext = createContext<UseUtmTrackingReturn | null>(null)

/**
 * UTM Provider component
 *
 * Wraps the application (or a subtree) to provide UTM tracking state to all
 * child components via React context.
 *
 * @param props - Provider props including config and children
 *
 * @example
 * ```typescript
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <UtmProvider config={{ storageKey: 'myapp_utm' }}>
 *       <MyComponent />
 *     </UtmProvider>
 *   );
 * }
 *
 * // Access UTM state in any child component
 * function MyComponent() {
 *   const { utmParameters, appendToUrl } = useUtmContext();
 *   // ...
 * }
 * ```
 */
export function UtmProvider({ config, children }: UtmProviderProps): React.ReactElement {
  // Use the tracking hook with provided config
  const utmTracking = useUtmTracking({ config })

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => utmTracking,
    [
      utmTracking.utmParameters,
      utmTracking.isEnabled,
      utmTracking.hasParams,
      utmTracking.capture,
      utmTracking.clear,
      utmTracking.appendToUrl,
    ],
  )

  return <UtmContext.Provider value={contextValue}>{children}</UtmContext.Provider>
}

/**
 * Hook to access UTM tracking context
 *
 * Must be used within a UtmProvider component.
 *
 * @returns UTM tracking state and functions
 * @throws Error if used outside of UtmProvider
 *
 * @example
 * ```typescript
 * function ShareButton() {
 *   const { appendToUrl } = useUtmContext();
 *   const shareUrl = appendToUrl('https://example.com', 'linkedin');
 *
 *   return <button onClick={() => share(shareUrl)}>Share</button>;
 * }
 * ```
 */
export function useUtmContext(): UseUtmTrackingReturn {
  const context = useContext(UtmContext)

  if (context === null) {
    throw new Error(
      'useUtmContext must be used within a UtmProvider. ' +
        'Wrap your component tree with <UtmProvider> or use useUtmTracking() directly.',
    )
  }

  return context
}

/**
 * Props for UtmProvider
 */
export interface UtmProviderComponentProps {
  /** Configuration options */
  config?: Partial<UtmConfig>
  /** Child components */
  children: React.ReactNode
}
