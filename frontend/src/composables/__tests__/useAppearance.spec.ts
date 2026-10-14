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
