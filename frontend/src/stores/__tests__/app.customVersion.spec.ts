import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '../app'
import { checkUpdates } from '@/api/admin/system'

vi.mock('@/api/admin/system', () => ({ checkUpdates: vi.fn() }))
vi.mock('@/api/auth', () => ({ getPublicSettings: vi.fn() }))
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('custom version cache', () => {
  it('retains the fusion status and personal image when returning cached version data', async () => {
    const info = { current_version: '0.2.15-custom.1', latest_version: '0.2.15-custom.2', has_update: true,
      build_type: 'release', cached: false, update_channel: 'custom' as const,
      upstream_version: '0.2.16', custom_image: 'ghcr.io/haipengtian/sub2api:0.2.15-custom.2',
      custom_sync: { status: 'conflict', upstream_tag: 'v0.2.16' } }
    vi.mocked(checkUpdates).mockResolvedValue(info)
    const store = useAppStore()
    await store.fetchVersion(true)
    const cached = await store.fetchVersion(false)
    expect(cached).toMatchObject({ update_channel: 'custom', upstream_version: '0.2.16',
      custom_sync: info.custom_sync, custom_image: info.custom_image })
    expect(checkUpdates).toHaveBeenCalledTimes(1)
  })
})
