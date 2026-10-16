<template>
  <span class="animated-number" :aria-label="format(target)"><span class="sr-only">{{ format(target) }}</span><span aria-hidden="true">{{ format(displayed) }}</span></span>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useAppearance } from '@/composables/useAppearance'

const props = defineProps<{ value: number; formatter?: (value: number) => string; integer?: boolean }>()
const { isEnhanced } = useAppearance()
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = ref(media.matches)
const onMotionChange = (event: MediaQueryListEvent) => { reduced.value = event.matches }
media.addEventListener?.('change', onMotionChange)
const target = computed(() => Number.isFinite(props.value) ? props.value : 0)
const displayed = ref(0)
const format = (value: number) => {
  const formattedValue = props.integer && value !== target.value ? Math.round(value) : value
  return props.formatter ? props.formatter(formattedValue) : Math.round(formattedValue).toString()
}
let frame: number | undefined
function stop() {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
}
watch([target, () => isEnhanced.value, reduced], ([to]) => {
  stop()
  if (!isEnhanced.value || reduced.value || typeof requestAnimationFrame !== 'function') {
    displayed.value = to
    return
  }
  const from = displayed.value
  if (from === to) return
  const started = performance.now()
  const tick = (time: number) => {
    const progress = Math.min(1, Math.max(0, (time - started) / 480))
    displayed.value = progress === 1 ? to : from + (to - from) * (1 - (1 - progress) ** 3)
    frame = progress < 1 ? requestAnimationFrame(tick) : undefined
  }
  frame = requestAnimationFrame(tick)
}, { immediate: true })
onScopeDispose(() => { stop(); media.removeEventListener?.('change', onMotionChange) })
</script>
