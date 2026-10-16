import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import MonitorHero from '../MonitorHero.vue'
import { useAppearance } from '@/composables/useAppearance'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)
afterEach(() => useAppearance().setSkin('modern'))

describe('Credit monitor toolbar', () => {
  it('hides the overall health badge without channels, preserving legacy skins', async () => {
    useAppearance().setSkin('credit')
    const wrapper = mount(MonitorHero, {
      props: { overallStatus: 'operational', intervalSeconds: 60, window: '7d', loading: false, hasChannels: false },
    })
    expect(wrapper.text()).not.toContain('channelStatus.overall.operational')
    await wrapper.setProps({ hasChannels: true })
    expect(wrapper.text()).toContain('channelStatus.overall.operational')
    await wrapper.setProps({ hasChannels: false })
    useAppearance().setSkin('classic')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('channelStatus.overall.operational')
  })

  it('keeps time range and refresh actions working', async () => {
    useAppearance().setSkin('credit')
    const wrapper = mount(MonitorHero, {
      props: { overallStatus: 'degraded', intervalSeconds: 60, window: '7d', loading: false },
    })
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    expect(wrapper.emitted('update:window')).toEqual([['15d']])
    const refresh = wrapper.get('button[title="common.refresh"]')
    await refresh.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    await wrapper.setProps({ loading: true })
    expect(refresh.attributes('disabled')).toBeDefined()
  })
})
