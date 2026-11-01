<template>
  <div class="space-y-2 rounded-xl bg-primary-50 p-3 dark:bg-primary-500/10" aria-live="polite">
    <div class="flex items-center justify-between text-sm font-medium text-primary-800 dark:text-primary-200">
      <span>{{ statusLabel }}</span>
      <span v-if="task.progress !== undefined">{{ task.progress }}%</span>
    </div>
    <div
      role="progressbar"
      :aria-label="t('admin.accounts.museVideoProgress')"
      :aria-valuenow="task.progress"
      aria-valuemin="0"
      aria-valuemax="100"
      class="h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900"
    >
      <div v-if="task.progress !== undefined" class="h-full rounded-full bg-primary-500 transition-[width]" :style="{ width: `${task.progress}%` }" />
    </div>
    <p class="break-all font-mono text-xs text-gray-500 dark:text-gray-400">{{ task.taskId }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AccountTestVideoTask } from '@/composables/useMuseVideoAccountTest'

const props = defineProps<{ task: AccountTestVideoTask }>()
const { t } = useI18n()
const statusLabel = computed(() => {
  switch (props.task.status) {
    case 'queued': return t('admin.accounts.museVideoQueued')
    case 'processing': return t('admin.accounts.museVideoProcessing')
    case 'completed': return t('admin.accounts.museVideoCompleted')
    case 'failed': case 'error': case 'canceled': case 'cancelled': return t('admin.accounts.testFailed')
    default: return props.task.status || t('admin.accounts.museVideoProgress')
  }
})
</script>
