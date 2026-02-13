import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { UtmHiddenFields } from '../../src/react/UtmHiddenFields'
import { useUtmFormData } from '../../src/react/useUtmFormData'
import { renderHook } from '@testing-library/react'
import { storeUtmParameters } from '../../src/common/storage'

describe('UtmHiddenFields', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('renders hidden inputs for stored UTM params', () => {
    storeUtmParameters({ utm_source: 'google', utm_medium: 'cpc' })
    const { container } = render(<UtmHiddenFields />)
    const inputs = container.querySelectorAll('input[type="hidden"]')
    expect(inputs.length).toBe(2)
  })

  it('sets correct name and value attributes', () => {
    storeUtmParameters({ utm_source: 'google' })
    const { container } = render(<UtmHiddenFields />)
    const input = container.querySelector('input[name="utm_source"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('google')
  })

  it('renders nothing when no params stored', () => {
    const { container } = render(<UtmHiddenFields />)
    const inputs = container.querySelectorAll('input')
    expect(inputs.length).toBe(0)
  })

  it('supports custom prefix for field names', () => {
    storeUtmParameters({ utm_source: 'google' })
    const { container } = render(<UtmHiddenFields prefix="tracking_" />)
    const input = container.querySelector('input[name="tracking_utm_source"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('google')
  })
})

describe('useUtmFormData', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('returns flat key-value record of UTM params', () => {
    storeUtmParameters({ utm_source: 'google', utm_medium: 'cpc' })
    const { result } = renderHook(() => useUtmFormData())
    expect(result.current).toEqual({ utm_source: 'google', utm_medium: 'cpc' })
  })

  it('returns empty object when no params stored', () => {
    const { result } = renderHook(() => useUtmFormData())
    expect(result.current).toEqual({})
  })
})
