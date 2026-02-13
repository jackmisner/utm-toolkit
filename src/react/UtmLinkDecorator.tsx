/**
 * UTM Link Decorator React Components
 *
 * Provides a component wrapper and hook for automatic link decoration within React.
 */

import React, { useRef, useEffect } from 'react'
import type { LinkDecoratorOptions } from '../outbound/decorator'
import { decorateLinks } from '../outbound/decorator'

/**
 * Hook that decorates links within a container ref.
 * Re-runs decoration on mount.
 */
export function useUtmLinkDecorator(
  options: LinkDecoratorOptions = {},
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return

    // Scope decoration to this container
    const container = ref.current
    const links = container.querySelectorAll<HTMLAnchorElement>(options.selector ?? 'a[href]')
    if (links.length === 0) return

    // Use decorateLinks with a scoped selector is tricky since it queries document.
    // Instead, manually scope: temporarily add a unique attribute and use it as selector.
    const scopeId = `__utm_decorator_${Date.now()}`
    container.setAttribute('data-utm-scope', scopeId)

    decorateLinks({
      ...options,
      selector: `[data-utm-scope="${scopeId}"] ${options.selector ?? 'a[href]'}`,
    })

    container.removeAttribute('data-utm-scope')
  }, [])

  return ref
}

export interface UtmLinkDecoratorProps extends LinkDecoratorOptions {
  children: React.ReactNode
}

/**
 * Component wrapper that decorates child links.
 */
export function UtmLinkDecorator(props: UtmLinkDecoratorProps): React.ReactElement {
  const { children, ...options } = props
  const ref = useUtmLinkDecorator(options)

  return <div ref={ref as React.RefObject<HTMLDivElement>}>{children}</div>
}
