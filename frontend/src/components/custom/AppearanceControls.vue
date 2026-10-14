<template>
  <div class="appearance-controls" :class="{ 'appearance-controls-stacked': stacked }">
    <button type="button" :class="buttonClass" :title="darkLabel" :aria-label="darkLabel" @click="toggleDark">
      <Icon :name="isDark ? 'sun' : 'moon'" size="md" />
      <span v-if="!collapsed">{{ darkLabel }}</span>
    </button>
    <button type="button" :class="buttonClass" :title="skinLabel" :aria-label="skinLabel" @click="toggleSkin">
      <Icon name="grid" size="md" />
      <span v-if="!collapsed">{{ skinLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useAppearance } from '@/composables/useAppearance'

const props = defineProps<{ collapsed?: boolean; stacked?: boolean }>()
const { t } = useI18n()
const { isModern, isDark, toggleSkin, toggleDark } = useAppearance()
const darkLabel = computed(() => t(isDark.value ? 'nav.lightMode' : 'nav.darkMode'))
const skinLabel = computed(() => t(isModern.value ? 'appearance.switchClassic' : 'appearance.switchModern'))
const buttonClass = computed(() => props.stacked
  ? ['sidebar-link w-full', { 'sidebar-link-collapsed': props.collapsed }]
  : 'btn btn-ghost btn-sm')
</script>
