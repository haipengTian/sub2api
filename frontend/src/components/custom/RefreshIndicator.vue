<template>
  <div v-if="active && isModern" class="modern-refresh-indicator" role="status">
    <span class="sr-only">{{ t('common.loading') }}</span>
    <span class="modern-refresh-track" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppearance } from '@/composables/useAppearance'
defineProps<{ active: boolean }>()
const { t } = useI18n()
const { isModern } = useAppearance()
</script>
