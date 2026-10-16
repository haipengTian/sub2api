import { mount, RouterLinkStub } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreditHome from '../CreditHome.vue'

vi.mock('vue-i18n', async original => ({ ...await original<typeof import('vue-i18n')>(), useI18n: () => ({ t: (key: string) => key }) }))

const wrappers: ReturnType<typeof mount>[] = []
let reduced = false

beforeEach(() => {
  vi.useFakeTimers()
  reduced = false
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ get matches() { return reduced } }) as MediaQueryList)
})

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function render() {
  const wrapper = mount(CreditHome, {
    props: { siteName: 'Sub2API', siteLogo: '', siteSubtitle: 'Gateway', docUrl: '', isAuthenticated: false, dashboardPath: '/dashboard', showModelPlazaEntry: false, isDark: false },
    global: { stubs: {
      RouterLink: RouterLinkStub, LocaleSwitcher: true, Icon: true,
      AnimatedNumber: { props: ['value', 'formatter', 'integer'], template: '<span>{{ formatter(value) }}</span>' },
    } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('Credit home Token demonstration', () => {
  it('labels the example and increases the cumulative integer total by the displayed gain', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const wrapper = render()
    const total = () => Number(wrapper.get('[data-testid="credit-token-total"]').text().replaceAll(',', ''))
    const initial = total()
    expect(initial).toBeGreaterThan(0)
    expect(wrapper.get('.credit-home-demo-badge').text()).toBe('appearance.homeDemoData')
    expect(wrapper.get('.credit-home-visual').attributes('aria-label')).toBe('appearance.homeProductPreview')
    for (let i = 0; i < 3; i++) {
      const before = total()
      await vi.advanceTimersByTimeAsync(4000)
      const gain = Number(wrapper.get('[data-testid="credit-token-gain"]').text().match(/[\d,]+/)![0].replaceAll(',', ''))
      expect(Number.isInteger(gain)).toBe(true)
      expect(gain).toBeGreaterThan(0)
      expect(total()).toBe(before + gain)
      expect(wrapper.get('.credit-home-token-rise').text()).toContain(`+${gain}`)
    }
    expect(total()).toBeGreaterThan(initial)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps a stable example for reduced motion and pauses in a hidden tab', async () => {
    reduced = true
    const wrapper = render()
    const initial = wrapper.get('[data-testid="credit-token-total"]').text()
    await vi.advanceTimersByTimeAsync(8000)
    expect(wrapper.get('[data-testid="credit-token-total"]').text()).toBe(initial)
    reduced = false
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.get('[data-testid="credit-token-total"]').text()).toBe(initial)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.get('[data-testid="credit-token-total"]').text()).not.toBe(initial)
  })
})
