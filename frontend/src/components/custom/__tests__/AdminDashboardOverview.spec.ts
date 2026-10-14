import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AdminDashboardOverview from '../AdminDashboardOverview.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key} ${Object.values(values).join(' / ')}` : key })
}))

const render = (simpleMode = false) => mount(AdminDashboardOverview, {
  props: { simpleMode, stats: { total_accounts: 6, normal_accounts: 4, error_accounts: 2 } },
  global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, Icon: true } }
})

describe('admin dashboard overview', () => {
  it('links to the existing admin management routes', () => {
    const routes = render().findAll('a').map(link => link.attributes('href'))
    expect(routes).toEqual(['/admin/accounts', '/admin/users', '/admin/groups', '/admin/settings'])
  })

  it('honors simple mode by hiding user management', () => {
    const wrapper = render(true)
    expect(wrapper.find('a[href="/admin/users"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/admin/accounts"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/admin/groups"]').exists()).toBe(true)
  })

  it('does not claim a healthy service while showing account statistics', () => {
    expect(render().get('[data-testid="admin-account-summary"]').text()).toBe('appearance.adminAccountSummary 4 / 6 / 2')
  })

  it('omits account statistics until they have loaded', async () => {
    const wrapper = render()
    await wrapper.setProps({ stats: null })
    expect(wrapper.find('[data-testid="admin-account-summary"]').exists()).toBe(false)
    expect(wrapper.findAll('a')).toHaveLength(4)
  })
})
