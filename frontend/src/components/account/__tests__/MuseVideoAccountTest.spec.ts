import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountTestModal from '../AccountTestModal.vue'
import AdminAccountTestModal from '../../admin/account/AccountTestModal.vue'

const { getAvailableModels } = vi.hoisted(() => ({ getAvailableModels: vi.fn() }))
vi.mock('@/api/admin', () => ({ adminAPI: { accounts: { getAvailableModels } } }))
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => ({ copyToClipboard: vi.fn() }) }))
vi.mock('vue-i18n', async () => ({
  ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'),
  useI18n: () => ({ t: (key: string) => key })
}))

function stream(events: Record<string, unknown>[]) {
  const chunks = events.map(event => new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
  return { ok: true, body: { getReader: () => ({
    read: async () => chunks.length ? { done: false, value: chunks.shift() } : { done: true }
  }) } }
}

const stubs = {
  BaseDialog: { template: '<div><slot /><slot name="footer" /></div>' },
  Select: {
    props: ['modelValue', 'options', 'valueKey', 'labelKey'],
    emits: ['update:modelValue'],
    template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="option in options" :key="option[valueKey || 'value']" :value="option[valueKey || 'value']">{{ option[labelKey || 'label'] }}</option>
    </select>`
  },
  TextArea: {
    props: ['modelValue', 'label', 'hint'], emits: ['update:modelValue'],
    template: `<label>{{ label }}<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /><span>{{ hint }}</span></label>`
  },
  Icon: true
}

describe.each([
  ['classic', AccountTestModal], ['admin', AdminAccountTestModal]
] as const)('%s Muse video account test', (_name, Component) => {
  beforeEach(() => {
    getAvailableModels.mockResolvedValue([
      { id: 'movie', display_name: 'Muse Video' },
      { id: 'gpt-image-2', display_name: 'GPT Image' },
      { id: 'gpt-5.4', display_name: 'GPT' }
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream([
      { type: 'test_start', model: 'muse-video' },
      { type: 'status', status: 'processing', data: { task_id: 'task_1', progress: 42 }, text: 'status=processing progress=42' },
      { type: 'video', video_url: 'data:video/mp4;base64,QUJD', mime_type: 'video/mp4' },
      { type: 'test_complete', success: true }
    ])))
  })
  afterEach(() => vi.unstubAllGlobals())

  async function open(type = 'apikey') {
    const wrapper = mount(Component, {
      props: { show: false, account: {
        id: 42, name: 'Muse', platform: 'openai', type, status: 'active',
        credentials: { model_mapping: { movie: 'muse-video', 'gpt-image-2': 'gpt-image-2', 'gpt-5.4': 'gpt-5.4' } }
      } as any }, global: { stubs }
    })
    await wrapper.setProps({ show: true })
    await flushPromises()
    return wrapper
  }

  it('recognizes mapped video models, hides chat mode, and previews the generated video', async () => {
    const wrapper = await open()
    expect(wrapper.findAll('select')).toHaveLength(1)
    expect(wrapper.text()).toContain('admin.accounts.videoPromptLabel')
    expect(wrapper.text()).toContain('admin.accounts.museVideoTestHint')
    await wrapper.get('textarea').setValue('海浪轻轻拍打沙滩')
    const start = wrapper.findAll('button').find(b => b.text().includes('admin.accounts.startTest'))!
    await start.trigger('click')
    await flushPromises()
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({
      model_id: 'movie', prompt: '海浪轻轻拍打沙滩', mode: 'default'
    })
    expect(wrapper.text()).toContain('admin.accounts.sendingVideoRequest')
    expect(wrapper.text()).toContain('status=processing progress=42')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('42')
    expect(wrapper.get('video').attributes('src')).toBe('data:video/mp4;base64,QUJD')
    expect(wrapper.text()).toContain('admin.accounts.testCompleted')
    wrapper.unmount()
  })

  it('keeps image and text tests intact when switching models', async () => {
    const wrapper = await open()
    await wrapper.get('select').setValue('gpt-image-2')
    expect(wrapper.text()).toContain('admin.accounts.imagePromptLabel')
    expect(wrapper.text()).not.toContain('admin.accounts.museVideoTestHint')
    await wrapper.findAll('select')[0].setValue('gpt-5.4')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.findAll('select')).toHaveLength(2)
    wrapper.unmount()
  })

  it('does not activate Muse video for OAuth accounts', async () => {
    const wrapper = await open('oauth')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.findAll('select')).toHaveLength(2)
    wrapper.unmount()
  })

  it('matches longest wildcard mappings while exact mappings take priority', async () => {
    const wrapper = await open()
    await wrapper.setProps({ account: { ...wrapper.props('account'), credentials: { model_mapping: {
      '*': 'gpt-5.4', 'muse-*': 'muse-video', 'muse-text*': 'gpt-5.4', 'muse-special': 'gpt-5.4'
    } } } as any })
    ;(wrapper.vm as any).selectedModelId = 'muse-spark'
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(true)
    ;(wrapper.vm as any).selectedModelId = 'muse-text-test'
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    ;(wrapper.vm as any).selectedModelId = 'muse-special'
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })

  if (_name === 'admin') it('clears a previous reference image when reopening or switching accounts', async () => {
    const wrapper = await open()
    ;(wrapper.vm as any).uploadImageDataURL = 'data:image/png;base64,QUJD'
    ;(wrapper.vm as any).uploadImageName = 'private.png'
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true, account: { ...wrapper.props('account'), id: 43 } as any })
    await flushPromises()
    expect((wrapper.vm as any).uploadImageDataURL).toBe('')
    expect((wrapper.vm as any).uploadImageName).toBe('')
    ;(wrapper.vm as any).uploadImageDataURL = 'data:image/png;base64,QUJD'
    await wrapper.setProps({ account: { ...wrapper.props('account'), id: 44 } as any })
    await flushPromises()
    expect((wrapper.vm as any).uploadImageDataURL).toBe('')
    wrapper.unmount()
  })

  it('recognizes the native muse-video model and resets a previous compact selection', async () => {
    getAvailableModels.mockResolvedValue([{ id: 'gpt-5.4', display_name: 'GPT' }, { id: 'muse-video', display_name: 'Muse' }])
    const wrapper = await open()
    ;(wrapper.vm as any).testMode = 'compact'
    await wrapper.findAll('select')[0].setValue('muse-video')
    expect(wrapper.findAll('select')).toHaveLength(1)
    await (wrapper.vm as any).startTest()
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).mode).toBe('default')
    wrapper.unmount()
  })

  it('reports a disconnected stream instead of waiting forever or marking success', async () => {
    vi.mocked(fetch).mockResolvedValue(stream([{ type: 'status', status: 'processing', data: { task_id: 'task_1' } }]) as Response)
    const wrapper = await open()
    await (wrapper.vm as any).startTest()
    expect(wrapper.text()).toContain('admin.accounts.museVideoStreamEnded')
    expect(wrapper.text()).not.toContain('admin.accounts.testCompleted')
    wrapper.unmount()
  })

  it('aborts the active request on close without resubmitting', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementation((_url, options) => {
      signal = options?.signal as AbortSignal
      return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    })
    const wrapper = await open()
    const start = wrapper.findAll('button').find(b => b.text().includes('admin.accounts.startTest'))!
    await start.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'common.close')!.trigger('click')
    expect(signal?.aborted).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('shows upstream failure without a video or successful completion', async () => {
    vi.mocked(fetch).mockResolvedValue(stream([{ type: 'error', error: 'Muse session unavailable' }]) as Response)
    const wrapper = await open()
    await (wrapper.vm as any).startTest()
    await flushPromises()
    expect(wrapper.text()).toContain('Muse session unavailable')
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('admin.accounts.testCompleted')
    wrapper.unmount()
  })
})
