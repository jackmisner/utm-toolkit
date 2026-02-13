import { describe, it, expect, vi, beforeEach } from 'vitest'
import { captureUtmParameters } from '../../src/inbound/capture'
import {
  storeUtmParameters,
  getStoredUtmParameters,
  clearStoredUtmParameters,
} from '../../src/common/storage'
import { appendUtmParameters } from '../../src/outbound/appender'

describe('Event Callbacks', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  describe('onCapture', () => {
    it('fires with captured params when UTM params found', () => {
      const onCapture = vi.fn()
      const result = captureUtmParameters('https://example.com?utm_source=google&utm_medium=cpc', {
        onCapture,
      })
      expect(onCapture).toHaveBeenCalledOnce()
      expect(onCapture).toHaveBeenCalledWith(result)
      expect(result).toEqual({ utm_source: 'google', utm_medium: 'cpc' })
    })

    it('does not fire when no UTM params found', () => {
      const onCapture = vi.fn()
      captureUtmParameters('https://example.com?foo=bar', { onCapture })
      expect(onCapture).not.toHaveBeenCalled()
    })

    it('does not fire when URL is invalid', () => {
      const onCapture = vi.fn()
      captureUtmParameters('not a valid url', { onCapture })
      expect(onCapture).not.toHaveBeenCalled()
    })

    it('is optional — works without callback', () => {
      const result = captureUtmParameters('https://example.com?utm_source=test')
      expect(result).toEqual({ utm_source: 'test' })
    })

    it('does not break capture if callback throws', () => {
      const onCapture = vi.fn(() => {
        throw new Error('callback error')
      })
      const result = captureUtmParameters('https://example.com?utm_source=google', { onCapture })
      expect(result).toEqual({ utm_source: 'google' })
    })
  })

  describe('onStore', () => {
    it('fires with params and meta after storing', () => {
      const onStore = vi.fn()
      storeUtmParameters({ utm_source: 'google' }, { onStore, storageType: 'session' })
      expect(onStore).toHaveBeenCalledOnce()
      expect(onStore).toHaveBeenCalledWith({ utm_source: 'google' }, { storageType: 'session' })
    })

    it('fires with correct storageType for localStorage', () => {
      const onStore = vi.fn()
      storeUtmParameters({ utm_source: 'linkedin' }, { onStore, storageType: 'local' })
      expect(onStore).toHaveBeenCalledWith({ utm_source: 'linkedin' }, { storageType: 'local' })
    })

    it('does not fire when params are empty', () => {
      const onStore = vi.fn()
      storeUtmParameters({}, { onStore })
      expect(onStore).not.toHaveBeenCalled()
    })

    it('is optional — works without callback', () => {
      storeUtmParameters({ utm_source: 'test' })
      const stored = getStoredUtmParameters({ keyFormat: 'snake_case' })
      expect(stored).toEqual({ utm_source: 'test' })
    })

    it('does not break storage if callback throws', () => {
      const onStore = vi.fn(() => {
        throw new Error('callback error')
      })
      storeUtmParameters({ utm_source: 'google' }, { onStore })
      const stored = getStoredUtmParameters({ keyFormat: 'snake_case' })
      expect(stored).toEqual({ utm_source: 'google' })
    })
  })

  describe('onClear', () => {
    it('fires when stored params are cleared', () => {
      const onClear = vi.fn()
      storeUtmParameters({ utm_source: 'google' })
      clearStoredUtmParameters({ onClear })
      expect(onClear).toHaveBeenCalledOnce()
    })

    it('is optional — works without callback', () => {
      storeUtmParameters({ utm_source: 'test' })
      clearStoredUtmParameters()
      const stored = getStoredUtmParameters()
      expect(stored).toBeNull()
    })

    it('does not break clearing if callback throws', () => {
      const onClear = vi.fn(() => {
        throw new Error('callback error')
      })
      storeUtmParameters({ utm_source: 'google' })
      clearStoredUtmParameters({ onClear })
      const stored = getStoredUtmParameters()
      expect(stored).toBeNull()
    })
  })

  describe('onExpire', () => {
    it('fires when expired data is auto-cleaned during retrieval', () => {
      const onExpire = vi.fn()
      // Store with a TTL that has already expired
      const now = Date.now()
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(now) // for storeUtmParameters
        .mockReturnValueOnce(now + 10000) // for getStoredUtmParameters (expired)
      storeUtmParameters({ utm_source: 'google' }, { storageType: 'local', ttl: 5000 })
      const result = getStoredUtmParameters({ storageType: 'local', onExpire })
      expect(result).toBeNull()
      expect(onExpire).toHaveBeenCalledOnce()
      expect(onExpire).toHaveBeenCalledWith('utm_parameters')
      vi.restoreAllMocks()
    })

    it('does not fire when data is not expired', () => {
      const onExpire = vi.fn()
      storeUtmParameters({ utm_source: 'google' }, { storageType: 'local', ttl: 60000 })
      getStoredUtmParameters({ storageType: 'local', onExpire })
      expect(onExpire).not.toHaveBeenCalled()
    })

    it('does not fire for sessionStorage (no TTL)', () => {
      const onExpire = vi.fn()
      storeUtmParameters({ utm_source: 'google' })
      getStoredUtmParameters({ onExpire })
      expect(onExpire).not.toHaveBeenCalled()
    })

    it('does not break retrieval if callback throws', () => {
      const onExpire = vi.fn(() => {
        throw new Error('callback error')
      })
      const now = Date.now()
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now + 10000)
      storeUtmParameters({ utm_source: 'google' }, { storageType: 'local', ttl: 5000 })
      const result = getStoredUtmParameters({ storageType: 'local', onExpire })
      expect(result).toBeNull()
      vi.restoreAllMocks()
    })
  })

  describe('onAppend', () => {
    it('fires with the final URL and params after appending', () => {
      const onAppend = vi.fn()
      const result = appendUtmParameters(
        'https://example.com',
        { utm_source: 'google' },
        { onAppend },
      )
      expect(onAppend).toHaveBeenCalledOnce()
      expect(onAppend).toHaveBeenCalledWith(result, { utm_source: 'google' })
    })

    it('does not fire when no valid UTM entries', () => {
      const onAppend = vi.fn()
      appendUtmParameters('https://example.com', {}, { onAppend })
      expect(onAppend).not.toHaveBeenCalled()
    })

    it('is optional — works without callback', () => {
      const result = appendUtmParameters('https://example.com', {
        utm_source: 'test',
      })
      expect(result).toContain('utm_source=test')
    })

    it('does not break appending if callback throws', () => {
      const onAppend = vi.fn(() => {
        throw new Error('callback error')
      })
      const result = appendUtmParameters(
        'https://example.com',
        { utm_source: 'google' },
        { onAppend },
      )
      expect(result).toContain('utm_source=google')
    })
  })
})
