<template>
  <button
    v-if="isCredit"
    type="button"
    class="credit-width-toggle hidden lg:inline-flex"
    :aria-label="label"
    :title="label"
    :aria-pressed="isFullWidth"
    @click="toggleFullWidth"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path v-if="isFullWidth" d="m4 14 6 0 0 6 M10 14 3 21 M20 10l-6 0 0-6 M14 10l7-7" />
      <path v-else d="M15 3h6v6 M21 3l-7 7 M9 21H3v-6 M3 21l7-7" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppearance } from '@/composables/useAppearance'

const { t } = useI18n()
const { isCredit, isFullWidth, toggleFullWidth } = useAppearance()
const label = computed(() => t(isFullWidth.value ? 'appearance.containContent' : 'appearance.expandContent'))
</script>

<style scoped>
.credit-width-toggle {
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--credit-muted-foreground);
  transition: color 160ms, background-color 160ms;
}
.credit-width-toggle:hover { color: var(--credit-foreground); background: var(--credit-muted); }
.credit-width-toggle:focus-visible { outline: 2px solid var(--credit-accent); outline-offset: 2px; }
</style>
