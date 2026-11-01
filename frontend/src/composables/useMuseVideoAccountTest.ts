import { computed, ref, type Ref } from 'vue'
import type { Account } from '@/types'

export interface AccountTestVideoTask {
  taskId: string
  status: string
  progress?: number
}

export function useMuseVideoAccountTest(account: () => Account | null, selectedModelId: Ref<string>) {
  const supported = computed(() => {
    const current = account()
    if (current?.platform !== 'openai' || current.type !== 'apikey') return false
    const mapping = current.credentials?.model_mapping as Record<string, unknown> | undefined
    const requested = selectedModelId.value
    const resolve = (id: string) => {
      if (!mapping) return undefined
      if (Object.prototype.hasOwnProperty.call(mapping, id)) return mapping[id]
      const wildcard = Object.keys(mapping)
        .filter(pattern => pattern.endsWith('*') && id.startsWith(pattern.slice(0, -1)))
        .sort((a, b) => b.length - a.length || a.localeCompare(b))[0]
      return wildcard === undefined ? undefined : mapping[wildcard]
    }
    const target = resolve(requested) ?? resolve(requested.trim()) ?? requested
    return typeof target === 'string' && target.trim().toLowerCase() === 'muse-video'
  })
  const task = ref<AccountTestVideoTask | null>(null)
  const updateTask = (event: { status?: string; data?: { task_id?: string; progress?: number } }) => {
    if (!supported.value || !event.data?.task_id) return
    task.value = {
      taskId: event.data.task_id,
      status: event.status || '',
      progress: typeof event.data.progress === 'number' && Number.isFinite(event.data.progress)
        ? Math.max(0, Math.min(100, event.data.progress)) : undefined
    }
  }
  return { supported, task, updateTask }
}
