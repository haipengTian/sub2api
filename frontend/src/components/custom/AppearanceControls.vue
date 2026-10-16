<template>
  <div class="appearance-controls" :class="{ 'appearance-controls-stacked': stacked }">
    <button type="button" :class="buttonClass" :title="darkLabel" :aria-label="darkLabel" @click="toggleDark">
      <Icon :name="isDark ? 'sun' : 'moon'" size="md" />
      <span v-if="!collapsed">{{ darkLabel }}</span>
    </button>
    <Select class="appearance-skin-select" :class="{ 'appearance-skin-collapsed': collapsed }" :model-value="skin" :options="skinOptions" :aria-label="t('appearance.style')" :searchable="false" @update:model-value="setSkin($event as Skin)">
      <template #selected="{ option }"><span class="flex min-w-0 items-center gap-2"><Icon name="grid" size="md" /><span v-if="!collapsed" class="truncate">{{ option?.label }}</span></span></template>
    </Select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useAppearance, type Skin } from '@/composables/useAppearance'
import Select from '@/components/common/Select.vue'

const props = defineProps<{ collapsed?: boolean; stacked?: boolean }>()
const { t } = useI18n()
const { skin, isDark, setSkin, toggleDark } = useAppearance()
const darkLabel = computed(() => t(isDark.value ? 'nav.lightMode' : 'nav.darkMode'))
const skinOptions = computed(() => [
  { value: 'modern', label: t('appearance.switchModern') },
  { value: 'classic', label: t('appearance.switchClassic') },
  { value: 'credit', label: t('appearance.switchCredit') },
])
const buttonClass = computed(() => props.stacked
  ? ['sidebar-link w-full', { 'sidebar-link-collapsed': props.collapsed }]
  : 'btn btn-ghost btn-sm')
</script>
