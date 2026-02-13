import { describe, it, expect, beforeEach, vi } from 'vitest'
import { decorateLinks, observeAndDecorateLinks } from '../../src/outbound/decorator'
import { storeUtmParameters } from '../../src/common/storage'

function createLink(href: string, parent?: HTMLElement): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  ;(parent ?? document.body).appendChild(a)
  return a
}

describe('decorateLinks', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    document.body.replaceChildren()
  })

  it('appends stored UTM params to links on the page', () => {
    storeUtmParameters({ utm_source: 'google', utm_medium: 'cpc' })
    createLink('https://example.com/page')
    const count = decorateLinks()
    expect(count).toBe(1)
    const link = document.querySelector('a') as HTMLAnchorElement
    expect(link.href).toContain('utm_source=google')
    expect(link.href).toContain('utm_medium=cpc')
  })

  it('returns 0 when no params stored', () => {
    createLink('https://example.com')
    const count = decorateLinks()
    expect(count).toBe(0)
  })

  it('returns 0 when no links on page', () => {
    storeUtmParameters({ utm_source: 'google' })
    const count = decorateLinks()
    expect(count).toBe(0)
  })

  describe('host filtering', () => {
    it('only decorates internal links by default', () => {
      storeUtmParameters({ utm_source: 'google' })
      // jsdom default location is https://example.com
      createLink('https://example.com/page1')
      createLink('https://other-site.com/page2')
      const count = decorateLinks()
      expect(count).toBe(1)
      const links = document.querySelectorAll('a')
      expect(links[0].href).toContain('utm_source=google')
      expect(links[1].href).not.toContain('utm_source')
    })

    it('decorates all links when internalOnly is false', () => {
      storeUtmParameters({ utm_source: 'google' })
      createLink('https://example.com/page')
      createLink('https://other-site.com/page')
      const count = decorateLinks({ internalOnly: false })
      expect(count).toBe(2)
    })

    it('includes additional hosts when specified', () => {
      storeUtmParameters({ utm_source: 'google' })
      createLink('https://example.com/page')
      createLink('https://partner.com/page')
      createLink('https://other.com/page')
      const count = decorateLinks({ includeHosts: ['partner.com'] })
      expect(count).toBe(2)
    })

    it('excludes specified hosts', () => {
      storeUtmParameters({ utm_source: 'google' })
      createLink('https://example.com/page1')
      createLink('https://example.com/page2')
      const count = decorateLinks({
        internalOnly: false,
        excludeHosts: ['example.com'],
      })
      expect(count).toBe(0)
    })
  })

  describe('skipExisting', () => {
    it('skips links that already have UTM params by default', () => {
      storeUtmParameters({ utm_source: 'google' })
      createLink('https://example.com?utm_source=existing')
      const count = decorateLinks()
      expect(count).toBe(0)
      const link = document.querySelector('a') as HTMLAnchorElement
      expect(link.href).toContain('utm_source=existing')
      expect(link.href).not.toContain('utm_source=google')
    })

    it('decorates links with existing UTMs when skipExisting is false', () => {
      storeUtmParameters({ utm_source: 'google' })
      createLink('https://example.com?utm_source=existing')
      const count = decorateLinks({ skipExisting: false })
      expect(count).toBe(1)
    })
  })

  describe('options', () => {
    it('uses custom CSS selector', () => {
      storeUtmParameters({ utm_source: 'google' })
      const a1 = createLink('https://example.com/page1')
      a1.className = 'track'
      createLink('https://example.com/page2')
      const count = decorateLinks({ selector: 'a.track' })
      expect(count).toBe(1)
    })

    it('appends extra static params', () => {
      storeUtmParameters({ utm_source: 'google' })
      createLink('https://example.com/page')
      decorateLinks({ extraParams: { utm_campaign: 'spring' } })
      const link = document.querySelector('a') as HTMLAnchorElement
      expect(link.href).toContain('utm_source=google')
      expect(link.href).toContain('utm_campaign=spring')
    })

    it('fires onAppend callback for each decorated link', () => {
      const onAppend = vi.fn()
      storeUtmParameters({ utm_source: 'google' })
      createLink('https://example.com/page')
      decorateLinks({ onAppend })
      expect(onAppend).toHaveBeenCalledOnce()
    })
  })
})

describe('observeAndDecorateLinks', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.body.replaceChildren()
  })

  it('returns a cleanup function', () => {
    storeUtmParameters({ utm_source: 'google' })
    const cleanup = observeAndDecorateLinks()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })

  it('decorates existing links immediately', () => {
    storeUtmParameters({ utm_source: 'google' })
    createLink('https://example.com/page')
    observeAndDecorateLinks()
    const link = document.querySelector('a') as HTMLAnchorElement
    expect(link.href).toContain('utm_source=google')
  })
})
