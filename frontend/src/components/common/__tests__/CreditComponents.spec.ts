import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import Toggle from '../Toggle.vue'
import Toast from '../Toast.vue'
import HelpTooltip from '../HelpTooltip.vue'
import { useAppStore } from '@/stores/app'

enableAutoUnmount(afterEach)
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('shared component presentation hooks', () => {
  it('styles switches without changing their value contract', async () => {
    const w = mount(Toggle, { props: { modelValue: false } })
    expect(w.get('[role="switch"]').classes()).toContain('ui-switch')
    expect(w.get('.ui-switch-thumb').exists()).toBe(true)
    expect(w.get('[role="switch"]').attributes('aria-checked')).toBe('false')
    await w.get('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    await w.setProps({ modelValue: true })
    expect(w.get('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('provides named toast motion while retaining status colors, dismissal and lifetime', async () => {
    vi.useFakeTimers()
    const store = useAppStore()
    const w = mount(Toast, { attachTo: document.body })
    const id = store.showSuccess('Saved', 3000)
    store.showToast('error', 'Try again')
    await nextTick()
    expect(document.querySelector('.toast-stack[aria-live="polite"]')).not.toBeNull()
    expect(document.querySelector('.toast-item[data-type="success"]')?.textContent).toContain('Saved')
    expect(document.querySelector('.toast-item[data-type="error"]')?.classList.contains('border-red-500')).toBe(true)
    expect(w.findComponent({ name: 'TransitionGroup' }).props('name')).toBe('toast')
    // Dismiss the error explicitly; no presentation change may alter the timer.
    document.querySelector<HTMLButtonElement>('.toast-item[data-type="error"] button')!.click()
    await nextTick()
    expect(store.toasts.map(t => t.id)).toEqual([id])
    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(store.toasts).toHaveLength(0)
  })

  it('animates the help surface without changing its hover/copy interaction', async () => {
    const w = mount(HelpTooltip, { attachTo: document.body, props: { content: 'Usage details' } })
    await w.get('.group').trigger('mouseenter')
    await nextTick()
    const tip = document.querySelector<HTMLElement>('.help-tooltip[role="tooltip"]')!
    expect(tip).not.toBeNull()
    expect(tip.textContent).toContain('Usage details')
    expect(tip.querySelector('.help-tooltip-arrow')).not.toBeNull()
    await w.get('.group').trigger('mouseleave', { relatedTarget: tip })
    expect(tip.style.display).not.toBe('none')
  })

  it('keeps fixed help bubbles in the viewport after scrolling and near the screen edges', async () => {
    vi.stubGlobal('scrollY', 900)
    vi.stubGlobal('innerWidth', 390)
    const w = mount(HelpTooltip, { attachTo: document.body, props: { content: 'Details' } })
    const trigger = w.get('.group')
    const tip = document.querySelector<HTMLElement>('[role="tooltip"]')!
    Object.defineProperty(tip, 'offsetWidth', { value: 256 })
    Object.defineProperty(tip, 'offsetHeight', { value: 80 })
    const box = vi.spyOn(trigger.element, 'getBoundingClientRect')
    box.mockReturnValue({ left: 350, top: 200, bottom: 216, width: 16 } as DOMRect)
    await trigger.trigger('mouseenter')
    await nextTick()
    expect(tip.style.top).toBe('192px')
    expect(tip.style.left).toBe('246px')
    expect(tip.dataset.placement).toBe('top')
    box.mockReturnValue({ left: 10, top: 20, bottom: 36, width: 16 } as DOMRect)
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(tip.style.top).toBe('44px')
    expect(tip.style.left).toBe('144px')
    expect(tip.dataset.placement).toBe('bottom')
  })
})
