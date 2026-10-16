import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentWidthToggle from '../ContentWidthToggle.vue'
import { initAppearance, useAppearance } from '@/composables/useAppearance'
import { readFileSync } from 'node:fs'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  localStorage.clear()
  initAppearance()
})

describe('Credit content width control', () => {
  it('uses interpolatable width limits and one shared header/content transition', () => {
    const css = readFileSync('src/styles/custom/credit.css', 'utf8')
    const fullRule = css.match(/html\[data-skin='credit'\]\[data-content-width='full'\][^{]+\{([^}]+)\}/)![1]
    expect(fullRule).toContain('max-width: 100%')
    expect(fullRule).not.toContain('max-width: none')
    const sharedRule = css.match(/html\[data-skin='credit'\] :is\(\.app-main, \.app-header > div\)\s*\{([^}]+)\}/)![1]
    expect(sharedRule).toMatch(/transition:\s*max-width\s+360ms/)
    expect(css).toContain('transition-duration: 0s !important')
  })

  it('only offers width switching in Credit and updates its accessible state', async () => {
    const wrapper = mount(ContentWidthToggle)
    expect(wrapper.find('button').exists()).toBe(false)
    useAppearance().setSkin('credit')
    await wrapper.vm.$nextTick()
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('appearance.expandContent')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-label')).toBe('appearance.containContent')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('sub2api-credit-full-width')).toBe('true')
    await button.trigger('click')
    expect(document.documentElement.dataset.contentWidth).toBe('contained')
    useAppearance().setSkin('classic')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})
