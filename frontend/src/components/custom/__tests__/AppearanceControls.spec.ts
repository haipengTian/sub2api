import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import AppearanceControls from '../AppearanceControls.vue'
import { initAppearance } from '@/composables/useAppearance'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {
  appearance: { switchClassic: () => 'Classic style', switchModern: () => 'Modern style' },
  nav: { lightMode: () => 'Light mode', darkMode: () => 'Dark mode' },
} } })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('theme', 'light')
  initAppearance()
})

describe('appearance controls', () => {
  it('changes styles and color modes through accessible buttons', async () => {
    const wrapper = mount(AppearanceControls, { global: { plugins: [i18n] } })
    await wrapper.get('[aria-label="Classic style"]').trigger('click')
    expect(document.documentElement.dataset.skin).toBe('classic')
    await wrapper.get('[aria-label="Dark mode"]').trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(wrapper.find('[aria-label="Modern style"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('keeps icon-only buttons labelled when the sidebar is collapsed', () => {
    const wrapper = mount(AppearanceControls, { props: { collapsed: true, stacked: true }, global: { plugins: [i18n] } })
    expect(wrapper.findAll('button').map(button => button.attributes('aria-label'))).toEqual(['Dark mode', 'Classic style'])
    expect(wrapper.findAll('button span')).toHaveLength(0)
    wrapper.unmount()
  })
})
