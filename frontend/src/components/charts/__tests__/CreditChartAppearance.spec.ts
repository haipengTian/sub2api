import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { initAppearance, useAppearance } from '@/composables/useAppearance'
import ModelDistributionChart from '../ModelDistributionChart.vue'
import TokenUsageTrend from '../TokenUsageTrend.vue'
import UserDashboardCharts from '@/components/user/dashboard/UserDashboardCharts.vue'
import OpsLatencyChart from '@/views/admin/ops/components/OpsLatencyChart.vue'
import OpsErrorDistributionChart from '@/views/admin/ops/components/OpsErrorDistributionChart.vue'

vi.mock('vue-i18n', async original => ({ ...await original<typeof import('vue-i18n')>(), useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-chartjs', () => ({
  Doughnut: { name: 'Doughnut', props: ['data', 'options'], template: '<canvas />' },
  Line: { name: 'Line', props: ['data', 'options'], template: '<canvas />' },
  Bar: { name: 'Bar', props: ['data', 'options'], template: '<canvas />' },
}))
const wrappers: VueWrapper[] = []
const models = [{ model: 'Claude', total_tokens: 1200, requests: 10, actual_cost: 1.2, cost: 2, input_tokens: 1000, output_tokens: 200, cache_creation_tokens: 0, cache_read_tokens: 0 }]
beforeEach(() => {
  localStorage.setItem('sub2api-skin', 'credit')
  localStorage.setItem('theme', 'light')
  initAppearance()
})
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()))
function render(component: Parameters<typeof mount>[0], props: Record<string, unknown>) {
  const wrapper = mount(component, { props, global: { stubs: { HelpTooltip: true, EmptyState: true, DateRangePicker: true, Select: true } } })
  wrappers.push(wrapper)
  return wrapper
}

describe('Credit charts', () => {
  it('updates both user and admin rings without changing data or value tooltips', () => {
    const user = render(UserDashboardCharts, { loading: false, startDate: '2026-10-10', endDate: '2026-10-16', granularity: 'day', trend: [], models })
    const admin = render(ModelDistributionChart, { modelStats: models })
    for (const wrapper of [user, admin]) {
      const chart = wrapper.findComponent({ name: 'Doughnut' })
      expect(chart.props('data').datasets[0].backgroundColor[0]).toBe('#6f63f6')
      expect(chart.props('data').datasets[0].data).toEqual([1200])
      expect(chart.props('options').cutout).toBe('72%')
      expect(chart.props('options').plugins.tooltip.cornerRadius).toBe(10)
    }
    expect(admin.findComponent({ name: 'Doughnut' }).props('options').plugins.tooltip.callbacks.label({ label: 'Claude', raw: 1200, dataset: { data: [1200] } })).toContain('100.0%')
  })

  it('gives histogram bars the Credit shape and reacts to light/dark toggles', async () => {
    const w = render(OpsLatencyChart, { loading: false, latencyData: { total_requests: 10, buckets: [{ range: '0–100ms', count: 10 }] } })
    const chart = w.findComponent({ name: 'Bar' })
    expect(chart.props('data').datasets[0]).toMatchObject({ backgroundColor: '#6f63f6', borderRadius: 6, maxBarThickness: 40 })
    expect(chart.props('options').plugins.tooltip.backgroundColor).toBe('#ffffff')
    useAppearance().toggleDark()
    await nextTick()
    expect(chart.props('data').datasets[0].backgroundColor).toBe('#a59cff')
    expect(chart.props('options').plugins.tooltip.backgroundColor).toBe('#18181b')
  })

  it('preserves the token percent axis and cost footer with the new line style', () => {
    const w = render(TokenUsageTrend, { trendData: [{ date: '2026-10-16', input_tokens: 100, output_tokens: 20, cache_creation_tokens: 10, cache_read_tokens: 50, cost: 2, actual_cost: 1 }] })
    const chart = w.findComponent({ name: 'Line' })
    expect(chart.props('data').datasets[0]).toMatchObject({ borderColor: '#6f63f6', pointRadius: 0, borderWidth: 2 })
    expect(chart.props('data').datasets[4].yAxisID).toBe('yPercent')
    expect(chart.props('options').scales.yPercent).toMatchObject({ min: 0, max: 100 })
    expect(chart.props('options').plugins.tooltip.callbacks.footer([{ dataIndex: 0 }])).toContain('Actual: $1.00')
  })

  it('keeps error categories and their HTML legends the same color', () => {
    const w = render(OpsErrorDistributionChart, { loading: false, data: { total: 8, items: [{ status_code: 500, total: 8, sla: 8, business_limited: 0 }] } })
    const color = w.findComponent({ name: 'Doughnut' }).props('data').datasets[0].backgroundColor[0]
    expect(color).toBe('#dc6477')
    expect(w.find('span.h-2.w-2').attributes('style')).toContain('rgb(220, 100, 119)')
  })

  it.each(['classic', 'modern'] as const)('restores the original %s charts when switching away', async skin => {
    const w = render(ModelDistributionChart, { modelStats: models })
    const originalChartId = w.findComponent({ name: 'Doughnut' }).vm.$.uid
    useAppearance().setSkin(skin)
    await nextTick()
    const chart = w.findComponent({ name: 'Doughnut' })
    expect(chart.props('data').datasets[0].backgroundColor[0]).toBe('#3b82f6')
    expect(chart.props('options').cutout).toBeUndefined()
    // vue-chartjs merges rather than removes options; a new instance clears Credit fields.
    expect(chart.vm.$.uid).not.toBe(originalChartId)
  })
})
