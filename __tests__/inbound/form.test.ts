import { describe, it, expect, beforeEach } from 'vitest'
import { populateFormFields, createUtmHiddenFields } from '../../src/inbound/form'
import { storeUtmParameters } from '../../src/common/storage'

/**
 * Helper to set up DOM elements for testing.
 * Uses DOM APIs instead of innerHTML to avoid XSS concerns in test code.
 * Note: These are test-only helpers using static, trusted content in jsdom.
 */
function createForm(id?: string): HTMLFormElement {
  const form = document.createElement('form')
  if (id) form.id = id
  document.body.appendChild(form)
  return form
}

function createInput(form: HTMLFormElement, attrs: Record<string, string>): HTMLInputElement {
  const input = document.createElement('input')
  for (const [key, value] of Object.entries(attrs)) {
    input.setAttribute(key, value)
  }
  form.appendChild(input)
  return input
}

describe('populateFormFields', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    document.body.replaceChildren()
  })

  describe('strategy: name', () => {
    it('populates input fields matching utm parameter names', () => {
      storeUtmParameters({ utm_source: 'google', utm_medium: 'cpc' })
      const form = createForm()
      createInput(form, { name: 'utm_source' })
      createInput(form, { name: 'utm_medium' })
      createInput(form, { name: 'other_field' })

      const count = populateFormFields({ strategy: 'name' })
      expect(count).toBe(2)
      const sourceInput = document.querySelector('input[name="utm_source"]') as HTMLInputElement
      const mediumInput = document.querySelector('input[name="utm_medium"]') as HTMLInputElement
      expect(sourceInput.value).toBe('google')
      expect(mediumInput.value).toBe('cpc')
    })

    it('returns 0 when no matching fields exist', () => {
      storeUtmParameters({ utm_source: 'google' })
      const form = createForm()
      createInput(form, { name: 'email' })
      const count = populateFormFields({ strategy: 'name' })
      expect(count).toBe(0)
    })

    it('returns 0 when no params are stored', () => {
      const form = createForm()
      createInput(form, { name: 'utm_source' })
      const count = populateFormFields({ strategy: 'name' })
      expect(count).toBe(0)
    })
  })

  describe('strategy: data-attribute', () => {
    it('populates input fields with data-utm attributes', () => {
      storeUtmParameters({ utm_source: 'google', utm_medium: 'cpc' })
      const form = createForm()
      createInput(form, { 'data-utm': 'source' })
      createInput(form, { 'data-utm': 'medium' })

      const count = populateFormFields({ strategy: 'data-attribute' })
      expect(count).toBe(2)
      const sourceInput = document.querySelector('input[data-utm="source"]') as HTMLInputElement
      expect(sourceInput.value).toBe('google')
    })

    it('supports custom data attribute name', () => {
      storeUtmParameters({ utm_source: 'google' })
      const form = createForm()
      createInput(form, { 'data-tracking': 'source' })
      const count = populateFormFields({
        strategy: 'data-attribute',
        dataAttribute: 'data-tracking',
      })
      expect(count).toBe(1)
    })
  })

  describe('strategy: auto-create', () => {
    it('creates hidden inputs in matching forms', () => {
      storeUtmParameters({ utm_source: 'google', utm_medium: 'cpc' })
      createForm('myform')
      const count = populateFormFields({ strategy: 'auto-create' })
      expect(count).toBe(2)
      const inputs = document.querySelectorAll('input[type="hidden"]')
      expect(inputs.length).toBe(2)
    })
  })

  describe('options', () => {
    it('uses custom CSS selector', () => {
      storeUtmParameters({ utm_source: 'google' })
      const trackForm = createForm()
      trackForm.className = 'track'
      createInput(trackForm, { name: 'utm_source' })

      const noTrackForm = createForm()
      noTrackForm.className = 'no-track'
      createInput(noTrackForm, { name: 'utm_source' })

      const count = populateFormFields({ strategy: 'name', selector: 'form.track' })
      expect(count).toBe(1)
    })

    it('uses custom storage key', () => {
      storeUtmParameters({ utm_source: 'google' }, { storageKey: 'custom_utm' })
      const form = createForm()
      createInput(form, { name: 'utm_source' })
      const count = populateFormFields({ strategy: 'name', storageKey: 'custom_utm' })
      expect(count).toBe(1)
    })
  })
})

describe('createUtmHiddenFields', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.body.replaceChildren()
  })

  it('creates hidden input elements in forms', () => {
    storeUtmParameters({ utm_source: 'google', utm_campaign: 'spring' })
    createForm()
    const count = createUtmHiddenFields()
    expect(count).toBe(2)
    const inputs = document.querySelectorAll('input[type="hidden"]')
    expect(inputs.length).toBe(2)
  })

  it('sets correct names and values', () => {
    storeUtmParameters({ utm_source: 'google' })
    createForm()
    createUtmHiddenFields()
    const input = document.querySelector('input[name="utm_source"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('hidden')
    expect(input.value).toBe('google')
  })

  it('returns 0 when no params stored', () => {
    createForm()
    const count = createUtmHiddenFields()
    expect(count).toBe(0)
  })

  it('works with multiple forms', () => {
    storeUtmParameters({ utm_source: 'google' })
    createForm()
    createForm()
    const count = createUtmHiddenFields()
    expect(count).toBe(2) // 1 field x 2 forms
  })
})
