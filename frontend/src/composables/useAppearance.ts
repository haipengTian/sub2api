import { computed, readonly, ref } from 'vue'

export type Skin = 'modern' | 'classic'
const skin = ref<Skin>('modern')
const dark = ref(false)
let observer: MutationObserver | undefined

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function save(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* Preferences remain usable without storage. */ }
}

/** Runs before mount; the skin is independent of the existing light/dark preference. */
export function initAppearance() {
  skin.value = read('sub2api-skin') === 'classic' ? 'classic' : 'modern'
  const theme = read('theme')
  dark.value = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.skin = skin.value
  document.documentElement.classList.toggle('dark', dark.value)
  // Older upstream pages also change the root class directly. Keep all controls in sync.
  observer?.disconnect()
  observer = new MutationObserver(() => {
    dark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}

export function useAppearance() {
  function toggleSkin() {
    skin.value = skin.value === 'modern' ? 'classic' : 'modern'
    document.documentElement.dataset.skin = skin.value
    save('sub2api-skin', skin.value)
  }
  function toggleDark() {
    dark.value = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', dark.value)
    save('theme', dark.value ? 'dark' : 'light')
  }
  return { skin: readonly(skin), isModern: computed(() => skin.value === 'modern'), isDark: readonly(dark), toggleSkin, toggleDark }
}
