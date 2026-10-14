import { computed, ref, watch } from 'vue'
import { useAppearance } from './useAppearance'

/** Preserve resolved content (including an empty result) during modern refreshes. */
export function useLoadingPresentation(loading: () => boolean, hasData: () => boolean, resolved: () => boolean = () => false) {
  const { isModern } = useAppearance()
  const settled = ref(hasData())
  watch(loading, (value, previous) => {
    if (previous && !value) settled.value = true
  })
  const showPlaceholder = computed(() => loading() && (!isModern.value || (!resolved() && !settled.value && !hasData())))
  return { isModern, showPlaceholder }
}
