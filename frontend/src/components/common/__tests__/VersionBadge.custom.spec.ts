import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import VersionBadge from '../VersionBadge.vue'

const { state, performUpdate, rollback, getRollbackVersions } = vi.hoisted(() => ({
  state: {
    currentVersion: '0.2.15-custom.1', latestVersion: '0.2.15-custom.1', hasUpdate: false,
    updateChannel: 'custom', upstreamVersion: '0.2.16', versionLoading: false,
    versionLoaded: true, buildType: 'release', releaseInfo: null,
    customSync: { status: 'conflict' }, fetchVersion: vi.fn()
  },
  performUpdate: vi.fn(), rollback: vi.fn(), getRollbackVersions: vi.fn()
}))
vi.mock('@/stores', () => ({ useAuthStore: () => ({ isAdmin: true }), useAppStore: () => reactive(state) }))
vi.mock('@/api/admin/system', () => ({ performUpdate, rollback, getRollbackVersions, restartService: vi.fn() }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => ({ copied: false, copyToClipboard: vi.fn() }) }))
enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { currentVersion: '0.2.15-custom.1', latestVersion: '0.2.15-custom.1', hasUpdate: false,
    updateChannel: 'custom', upstreamVersion: '0.2.16', customSync: { status: 'conflict' } })
})

async function openBadge() {
  const wrapper = mount(VersionBadge, { global: { stubs: { Icon: true, Transition: true } } })
  await wrapper.get('button').trigger('click')
  return wrapper
}

describe('custom update channel', () => {
  it.each(['waiting', 'conflict', 'manual_review', 'checking', 'publishing', 'checks_failed', 'publish_failed'])('keeps the deployed version for %s', async status => {
    state.customSync.status = status
    const wrapper = await openBadge()
    expect(wrapper.get('[data-testid="custom-update-panel"]').text()).toContain('version.customKeepCurrent')
    expect(wrapper.text()).toContain('v0.2.15-custom.1')
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(2) // badge and refresh, no install/rollback
    expect(performUpdate).not.toHaveBeenCalled()
    expect(rollback).not.toHaveBeenCalled()
    expect(getRollbackVersions).not.toHaveBeenCalled()
  })

  it('offers only the personal image after a custom release is available', async () => {
    Object.assign(state, { latestVersion: '0.2.16-custom.1', hasUpdate: true, customSync: { status: 'up_to_date' } })
    const wrapper = await openBadge()
    expect(wrapper.text()).toContain('version.customAvailable')
    expect(wrapper.get('pre').text()).toContain('bash update.sh ghcr.io/haipengtian/sub2api:0.2.16-custom.1')
    expect(wrapper.findAll('button')).toHaveLength(2)
    expect(wrapper.html()).not.toContain('weishaw/sub2api')
  })

  it('does not offer an official image even if legacy metadata says there is an update', async () => {
    Object.assign(state, { updateChannel: '', latestVersion: '0.2.16', hasUpdate: true, customSync: { status: 'unknown' } })
    const wrapper = await openBadge()
    expect(wrapper.get('[data-testid="custom-update-panel"]').text()).toContain('version.customUnknown')
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(2)
    expect(wrapper.text()).toContain('version.customLatest: v0.2.15-custom.1')
  })
})
