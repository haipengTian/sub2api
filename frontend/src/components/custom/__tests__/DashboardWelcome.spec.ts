import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/app'
import DashboardWelcome from '../DashboardWelcome.vue'

const copy = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => ({ copyToClipboard: copy }) }))
vi.mock('vue-i18n', async (original) => ({
  ...await original<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

beforeEach(() => { setActivePinia(createPinia()); copy.mockClear() })
const render = (isSimple = false) => mount(DashboardWelcome, {
  props: { name: 'Demo', balance: 12.5, requests: 42, cost: 1.2, isSimple },
  global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, Icon: true } },
})

describe('dashboard action band', () => {
  it('copies the configured endpoint instead of the reference website address', async () => {
    useAppStore().apiBaseUrl = 'https://proxy.example.test/v1'
    const wrapper = render()
    await wrapper.get('[data-testid="copy-endpoint"]').trigger('click')
    expect(copy).toHaveBeenCalledWith('https://proxy.example.test/v1')
  })
  it('hides payment and balance in simple mode', () => {
    const wrapper = render(true)
    expect(wrapper.find('[data-testid="welcome-balance"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="welcome-payment"]').exists()).toBe(false)
  })
  it('does not expose a disabled payment entry', () => {
    useAppStore().cachedPublicSettings = { payment_enabled: false } as never
    expect(render().find('[data-testid="welcome-payment"]').exists()).toBe(false)
  })
  it('uses the existing purchase route when payment is enabled', () => {
    useAppStore().cachedPublicSettings = { payment_enabled: true } as never
    expect(render().get('[data-testid="welcome-payment"]').attributes('to')).toBe('/purchase')
  })
  it('rounds balance consistently with the classic dashboard and header', () => {
    const wrapper = render()
    wrapper.setProps({ balance: 1.005 })
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.get('[data-testid="welcome-balance"]').text()).toContain('$1.01')
    })
  })
})
