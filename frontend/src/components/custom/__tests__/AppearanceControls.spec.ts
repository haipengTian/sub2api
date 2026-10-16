import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import AppearanceControls from '../AppearanceControls.vue'
import { initAppearance } from '@/composables/useAppearance'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {
  appearance: { style: () => 'Interface style', switchClassic: () => 'Classic style', switchModern: () => 'Modern style', switchCredit: () => 'Credit style' },
  nav: { lightMode: () => 'Light mode', darkMode: () => 'Dark mode' },
} } })
const global = { plugins: [i18n], stubs: { teleport: true } }

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('theme', 'light')
  initAppearance()
})

describe('appearance controls', () => {
  it('changes styles and color modes through accessible buttons', async () => {
    const wrapper = mount(AppearanceControls, { global })
    await wrapper.get('[aria-label="Interface style"]').trigger('click')
    await wrapper.findAll('[role="option"]').find(option => option.text() === 'Classic style')!.trigger('click')
    expect(document.documentElement.dataset.skin).toBe('classic')
    await wrapper.get('[aria-label="Dark mode"]').trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(wrapper.get('[aria-label="Interface style"]').text()).toContain('Classic style')
    wrapper.unmount()
  })
  it('keeps icon-only buttons labelled when the sidebar is collapsed', () => {
    const wrapper = mount(AppearanceControls, { props: { collapsed: true, stacked: true }, global })
    expect(wrapper.findAll('button').map(button => button.attributes('aria-label'))).toEqual(['Dark mode', 'Interface style'])
    expect(wrapper.get('[aria-label="Interface style"]').text()).not.toContain('Modern style')
    wrapper.unmount()
  })
  it('offers Credit alongside existing skins and persists the selection', async () => {
    const wrapper = mount(AppearanceControls, { global })
    await wrapper.get('[aria-label="Interface style"]').trigger('click')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
    await wrapper.findAll('[role="option"]').find(option => option.text() === 'Credit style')!.trigger('click')
    expect(document.documentElement.dataset.skin).toBe('credit')
    expect(localStorage.getItem('sub2api-skin')).toBe('credit')
    wrapper.unmount()
  })
})
