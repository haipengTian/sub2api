<template>
  <div class="modern-loading-placeholder" :class="`modern-loading-${kind}`" role="status" :aria-label="t('common.loading')">
    <span class="sr-only">{{ t('common.loading') }}</span>
    <div v-if="kind === 'dashboard'" aria-hidden="true">
      <div class="modern-skeleton mb-4 h-10 w-56" />
      <div class="modern-skeleton mb-6 h-4 w-64" />
      <div class="modern-action-band" :class="{ 'modern-action-band-simple': isSimple, 'modern-action-band-no-payment': !isSimple && !paymentEnabled }">
        <div v-for="i in actionCount" :key="i" class="modern-skeleton modern-action-tile" />
      </div>
      <div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div v-for="i in 3" :key="i" class="modern-skeleton h-28" />
      </div>
      <div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="modern-skeleton h-28" />
      </div>
    </div>
    <div v-else-if="kind === 'chart'" class="modern-skeleton h-48 w-full" aria-hidden="true" />
    <div v-else class="space-y-3" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="modern-skeleton h-16 w-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const props = withDefaults(defineProps<{ kind?: 'dashboard' | 'chart' | 'list'; isSimple?: boolean; paymentEnabled?: boolean }>(), { kind: 'list', paymentEnabled: false })
const { t } = useI18n()
const actionCount = computed(() => props.isSimple ? 2 : props.paymentEnabled ? 4 : 3)
</script>
