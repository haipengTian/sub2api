import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-skin')
  document.documentElement.classList.remove('dark')
  vi.resetModules()
  vi.restoreAllMocks()
})

async function appearance() {
  const module = await import('../useAppearance')
  module.initAppearance()
  return module.useAppearance()
}

describe('appearance preferences', () => {
  it('defaults to contained content and shares a persisted full-width preference', async () => {
    const first = await appearance()
    expect(first.isFullWidth.value).toBe(false)
    first.toggleFullWidth()
    expect(first.isFullWidth.value).toBe(true)
    expect(localStorage.getItem('sub2api-credit-full-width')).toBe('true')
    expect(document.documentElement.dataset.contentWidth).toBe('full')
    const { useAppearance } = await import('../useAppearance')
    expect(useAppearance().isFullWidth.value).toBe(true)
    first.setSkin('classic')
    first.setSkin('credit')
    expect(first.isFullWidth.value).toBe(true)
    expect((await appearance()).isFullWidth.value).toBe(true)
    first.toggleFullWidth()
    expect(document.documentElement.dataset.contentWidth).toBe('contained')
  })

  it('restores content width before first paint', async () => {
    const { readFileSync } = await import('node:fs')
    const script = readFileSync('index.html', 'utf8').match(/<script nonce="__CSP_NONCE_VALUE__">([\s\S]*?)<\/script>/)![1]
    localStorage.setItem('sub2api-credit-full-width', 'true')
    new Function(script)()
    expect(document.documentElement.dataset.contentWidth).toBe('full')
    localStorage.setItem('sub2api-credit-full-width', 'invalid')
    expect((await appearance()).isFullWidth.value).toBe(false)
  })

  it('restores Credit while keeping dark mode and existing skin flags independent', async () => {
    localStorage.setItem('sub2api-skin', 'credit')
    localStorage.setItem('theme', 'dark')
    const state = await appearance()
    expect(state.skin.value).toBe('credit')
    expect(document.documentElement.dataset.skin).toBe('credit')
    expect(state.isModern.value).toBe(false)
    expect(state.isCredit.value).toBe(true)
    expect(state.isEnhanced.value).toBe(true)
    expect(state.isDark.value).toBe(true)
  })

  it('selects each of three skins without changing the color preference', async () => {
    localStorage.setItem('theme', 'light')
    const state = await appearance()
    for (const value of ['credit', 'classic', 'modern'] as const) {
      state.setSkin(value)
      expect(state.skin.value).toBe(value)
      expect(document.documentElement.dataset.skin).toBe(value)
      expect(localStorage.getItem('sub2api-skin')).toBe(value)
      expect(state.isEnhanced.value).toBe(value !== 'classic')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    }
  })

  it('applies Credit before first paint using the same persisted preference', async () => {
    const { readFileSync } = await import('node:fs')
    const html = readFileSync('index.html', 'utf8')
    const script = html.match(/<script nonce="__CSP_NONCE_VALUE__">([\s\S]*?)<\/script>/)![1]
    localStorage.setItem('sub2api-skin', 'credit')
    localStorage.setItem('theme', 'dark')
    new Function(script)()
    expect(document.documentElement.dataset.skin).toBe('credit')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
  it('defaults to modern without overwriting the existing dark preference', async () => {
    localStorage.setItem('theme', 'dark')
    const state = await appearance()
    expect(state.skin.value).toBe('modern')
    expect(document.documentElement.dataset.skin).toBe('modern')
    expect(state.isDark.value).toBe(true)
  })

  it('restores classic and keeps color mode independent when switching skins', async () => {
    localStorage.setItem('sub2api-skin', 'classic')
    localStorage.setItem('theme', 'light')
    const state = await appearance()
    expect(state.skin.value).toBe('classic')
    state.toggleSkin()
    expect(localStorage.getItem('sub2api-skin')).toBe('modern')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    state.toggleDark()
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(state.skin.value).toBe('modern')
  })

  it('falls back to modern for an unknown stored skin', async () => {
    localStorage.setItem('sub2api-skin', 'unknown')
    expect((await appearance()).skin.value).toBe('modern')
  })

  it('shares changes across controls on the same page', async () => {
    const first = await appearance()
    const { useAppearance } = await import('../useAppearance')
    const second = useAppearance()
    first.toggleSkin()
    expect(second.skin.value).toBe('classic')
    expect(document.documentElement.dataset.skin).toBe('classic')
  })

  it('still switches when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const state = await appearance()
    expect(state.skin.value).toBe('modern')
    expect(() => state.toggleSkin()).not.toThrow()
    expect(state.skin.value).toBe('classic')
  })
})
