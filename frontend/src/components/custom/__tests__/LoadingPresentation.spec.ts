import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DataTable from '@/components/common/DataTable.vue'
import UserDashboardStats from '@/components/user/dashboard/UserDashboardStats.vue'
import UserDashboardRecentUsage from '@/components/user/dashboard/UserDashboardRecentUsage.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import DashboardView from '@/views/user/DashboardView.vue'
import { usageAPI } from '@/api/usage'
import { getMyPlatformQuotas } from '@/api/user'
import AnimatedNumber from '../AnimatedNumber.vue'
import UserDashboardCharts from '@/components/user/dashboard/UserDashboardCharts.vue'

const state = vi.hoisted(() => ({ modern: true, stats: vi.fn() }))
vi.mock('@/composables/useAppearance', () => ({ useAppearance: () => ({ isModern: { get value() { return state.modern } }, isDark: { value: false } }) }))
vi.mock('vue-i18n', async original => ({ ...await original<typeof import('vue-i18n')>(), useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { username: 'Demo', balance: 12 }, isSimpleMode: false, refreshUser: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('@/api/usage', () => ({ usageAPI: {
  getDashboardStats: (...args: unknown[]) => state.stats(...args),
  getDashboardTrend: vi.fn().mockResolvedValue({ trend: [] }),
  getDashboardModels: vi.fn().mockResolvedValue({ models: [] }),
  getByDateRange: vi.fn().mockResolvedValue({ items: [] }),
} }))
vi.mock('@/api/user', () => ({ getMyPlatformQuotas: vi.fn().mockResolvedValue([]) }))
vi.mock('vue-chartjs', () => ({ Line: { template: '<div data-test="chart" />' }, Doughnut: { template: '<div data-test="doughnut" />' } }))

const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  setActivePinia(createPinia()); state.modern = true; state.stats.mockReset()
  vi.mocked(usageAPI.getDashboardTrend).mockResolvedValue({ trend: [] } as never)
  vi.mocked(usageAPI.getDashboardModels).mockResolvedValue({ models: [] } as never)
  vi.mocked(usageAPI.getByDateRange).mockResolvedValue({ items: [] } as never)
  vi.mocked(getMyPlatformQuotas).mockResolvedValue({ platform_quotas: [] } as never)
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
function render(component: Parameters<typeof mount>[0], options: Parameters<typeof mount>[1] = {}) {
  const w = mount(component, options); wrappers.push(w); return w
}
const tableProps = { columns: [{ key: 'name', label: 'Name' }], data: [{ id: 1, name: 'Existing key' }] }

describe('modern loading presentation', () => {
  it.each([true, false])('retains table rows during refresh (desktop=%s)', async desktop => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: desktop, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList)
    const w = render(DataTable, { props: tableProps })
    await w.setProps({ loading: true })
    expect(w.text()).toContain('Existing key')
    expect(w.find('[aria-busy="true"]').exists()).toBe(true)
    await w.setProps({ data: [], loading: false })
    expect(w.text()).not.toContain('Existing key')
    expect(w.text()).toContain('empty.noData')
  })
  it('keeps classic table loading behaviour', async () => {
    state.modern = false
    const w = render(DataTable, { props: tableProps })
    await w.setProps({ loading: true })
    expect(w.text()).not.toContain('Existing key')
    expect(w.find('.animate-pulse').exists()).toBe(true)
  })
  it('keeps an already loaded empty recent-usage panel during refresh', async () => {
    const w = render(UserDashboardRecentUsage, { props: { loading: true, data: [] }, global: { stubs: { RouterLink: true, Icon: true } } })
    await w.setProps({ loading: false })
    expect(w.text()).toContain('dashboard.noUsageRecords')
    await w.setProps({ loading: true })
    expect(w.text()).toContain('dashboard.noUsageRecords')
    expect(w.find('[role="status"]').text()).toContain('common.loading')
  })
  it('keeps an empty result that resolved before the panel mounted', async () => {
    const w = render(UserDashboardRecentUsage, { props: { loading: false, data: [], resolved: true }, global: { stubs: { RouterLink: true } } })
    await w.setProps({ loading: true })
    expect(w.text()).toContain('dashboard.noUsageRecords')
    expect(w.find('.modern-loading-placeholder').exists()).toBe(false)
  })
  it('disables global refresh while stats are still refreshing', () => {
    const w = render(UserDashboardCharts, { props: { loading: false, refreshing: true, resolved: true, models: [], trend: [], startDate: '2026-10-01', endDate: '2026-10-14', granularity: 'day' }, global: { stubs: { DateRangePicker: true, Select: true, TokenUsageTrend: true } } })
    expect(w.get('button').attributes('disabled')).toBeDefined()
  })
  it('does not unmount the trend chart during refresh', async () => {
    const w = render(TokenUsageTrend, { props: { loading: false, trendData: [{ date: '2026-10-14', input_tokens: 10, output_tokens: 2 }] }, global: { stubs: { Line: { template: '<div data-test="chart" />' } } } })
    const chart = w.get('[data-test="chart"]').element
    await w.setProps({ loading: true })
    expect(w.find('[data-test="chart"]').exists()).toBe(true)
    expect(w.get('[data-test="chart"]').element).toBe(chart)
  })
  it('animates headline counts to the exact target', async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id })
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const step = async (time: number) => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); await nextTick() }
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList)
    const w = render(UserDashboardStats, { props: { stats: { today_requests: 286 }, balance: 0, isSimple: true }, global: { stubs: { Icon: true } } })
    const headline = () => w.findAll('p.text-xl')[1].get('[aria-hidden="true"]').text()
    expect(headline()).toBe('0')
    await step(250)
    expect(Number(headline().replace(/,/g, ''))).toBeGreaterThan(0)
    expect(Number(headline().replace(/,/g, ''))).toBeLessThan(286)
    await step(500)
    expect(headline()).toBe('286')
  })
  it('keeps dashboard content mounted while refreshing stats', async () => {
    state.stats.mockResolvedValueOnce({ today_requests: 286, today_actual_cost: 1.84 })
    const charts = { setup() { return { count: ref(0) } }, template: '<button data-test="refresh" @click="$emit(\'refresh\')">refresh</button>' }
    const w = render(DashboardView, { global: { stubs: {
      AppLayout: { template: '<div><slot /></div>' }, DashboardWelcome: true,
      UserDashboardStats: { template: '<div data-test="stats" />' }, UserDashboardCharts: charts,
      UserDashboardRecentUsage: true, UserDashboardQuickActions: true,
    } } })
    await flushPromises()
    const stats = w.get('[data-test="stats"]').element
    let resolve!: (value: unknown) => void
    state.stats.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await w.get('[data-test="refresh"]').trigger('click')
    await nextTick()
    expect(w.find('[data-test="stats"]').exists()).toBe(true)
    expect(w.get('[data-test="stats"]').element).toBe(stats)
    await flushPromises()
    await w.get('[data-test="refresh"]').trigger('click')
    expect(state.stats).toHaveBeenCalledTimes(2)
    resolve({ today_requests: 300, today_actual_cost: 2 }); await flushPromises()
  })
  it.each([true, false])('renders exact formatted money immediately when motion is disabled (modern=%s)', modern => {
    state.modern = modern
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList)
    const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const w = render(AnimatedNumber, { props: { value: 1.005, formatter: formatter.format } })
    expect(w.get('[aria-hidden="true"]').text()).toBe('1.01')
    expect(w.get('.sr-only').text()).toBe('1.01')
    expect(w.attributes('aria-label')).toBe('1.01')
  })
})
