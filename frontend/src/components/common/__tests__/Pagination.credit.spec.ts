import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import Pagination from '../Pagination.vue'
import { useAppearance } from '@/composables/useAppearance'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)
afterEach(() => useAppearance().setSkin('modern'))

describe('Credit pagination', () => {
  function render(total = 45) {
    useAppearance().setSkin('credit')
    return mount(Pagination, {
      props: { total, page: 1, pageSize: 20, showPageSizeSelector: false },
    })
  }

  it('uses a compact page counter with working previous/next navigation', async () => {
    const wrapper = render()
    expect(wrapper.get('.credit-page-status').text()).toBe('1 / 3')
    expect(wrapper.find('[aria-current="page"]').exists()).toBe(false)
    const nav = wrapper.get('nav')
    expect(nav.findAll('button')).toHaveLength(2)
    expect(nav.get('button').attributes('disabled')).toBeDefined()
    await nav.get('button[aria-label="pagination.next"]').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[2]])
    await wrapper.setProps({ page: 3 })
    expect(wrapper.get('.credit-page-status').text()).toBe('3 / 3')
    expect(nav.get('button[aria-label="pagination.next"]').attributes('disabled')).toBeDefined()
  })

  it('restores numbered pages when switching away from Credit', async () => {
    const wrapper = render()
    useAppearance().setSkin('classic')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.credit-page-status').exists()).toBe(false)
    expect(wrapper.get('[aria-current="page"]').text()).toBe('1')
  })

  it('shows one empty page and disables forward navigation for an empty result', () => {
    const wrapper = render(0)
    expect(wrapper.get('.credit-page-status').text()).toBe('1 / 1')
    expect(wrapper.get('nav button[aria-label="pagination.next"]').attributes('disabled')).toBeDefined()
  })
})
