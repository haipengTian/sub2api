import { computed, ref, watch } from 'vue'
import { useAppearance } from './useAppearance'

/** Preserve resolved content (including an empty result) in enhanced skins. */
export function useLoadingPresentation(loading: () => boolean, hasData: () => boolean, resolved: () => boolean = () => false) {
  const { isModern, isEnhanced } = useAppearance()
  const settled = ref(hasData())
  watch(loading, (value, previous) => {
    if (previous && !value) settled.value = true
  })
  const showPlaceholder = computed(() => loading() && (!isEnhanced.value || (!resolved() && !settled.value && !hasData())))
  return { isModern, isEnhanced, showPlaceholder }
}
