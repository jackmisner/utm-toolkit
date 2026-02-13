import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { UtmLinkDecorator, useUtmLinkDecorator } from '../../src/react/UtmLinkDecorator'
import { storeUtmParameters } from '../../src/common/storage'

describe('UtmLinkDecorator', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.body.replaceChildren()
  })

  it('decorates child links on mount', () => {
    storeUtmParameters({ utm_source: 'google' })
    const { container } = render(
      <UtmLinkDecorator>
        <a href="https://example.com/page">Link</a>
      </UtmLinkDecorator>,
    )
    const link = container.querySelector('a') as HTMLAnchorElement
    expect(link.href).toContain('utm_source=google')
  })

  it('does not decorate when no params stored', () => {
    const { container } = render(
      <UtmLinkDecorator>
        <a href="https://example.com/page">Link</a>
      </UtmLinkDecorator>,
    )
    const link = container.querySelector('a') as HTMLAnchorElement
    expect(link.href).not.toContain('utm_source')
  })
})

describe('useUtmLinkDecorator', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.body.replaceChildren()
  })

  it('returns a ref object', () => {
    storeUtmParameters({ utm_source: 'google' })
    const { result } = renderHook(() => useUtmLinkDecorator())
    expect(result.current).toBeDefined()
    expect(result.current).toHaveProperty('current')
  })
})
