<template>
  <div class="credit-home" data-testid="credit-home">
    <header class="credit-home-header">
      <router-link to="/home" class="credit-home-brand">
        <img :src="siteLogo || '/logo.svg'" alt="" />
        <span>{{ siteName }}</span>
      </router-link>
      <nav class="credit-home-nav" :aria-label="t('appearance.homeNavigation')">
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" class="credit-home-doc" :aria-label="t('home.viewDocs')">
          <Icon name="book" size="md" /><span>{{ t('home.docs') }}</span>
        </a>
        <LocaleSwitcher />
        <button type="button" class="credit-home-theme" :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')" @click="$emit('toggle-theme')">
          <Icon :name="isDark ? 'sun' : 'moon'" size="md" />
        </button>
        <router-link :to="destination" class="btn btn-secondary credit-home-login">
          {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
        </router-link>
      </nav>
    </header>

    <main class="credit-home-main">
      <section class="credit-home-hero" aria-labelledby="credit-home-title">
        <div class="credit-home-copy">
          <h1 id="credit-home-title"><span class="credit-home-name">{{ siteName }}</span><span class="credit-home-headline">{{ t('appearance.homeHeadline') }}</span></h1>
          <p class="credit-home-description"><span>{{ siteSubtitle }}</span><span>{{ t('appearance.homeIntroduction') }}</span></p>
          <div class="credit-home-actions">
            <router-link :to="destination" class="btn btn-primary" data-testid="credit-start">
              {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}<Icon name="arrowRight" size="md" />
            </router-link>
            <router-link v-if="showModelPlazaEntry" to="/model-plaza" class="btn btn-secondary">
              {{ t('nav.modelPlaza') }}
            </router-link>
            <a v-else-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
              {{ t('home.viewDocs') }}
            </a>
            <a v-else href="#credit-home-features" class="btn btn-secondary">{{ t('appearance.homeLearnMore') }}</a>
          </div>
          <div v-if="showModelPlazaEntry && docUrl" class="credit-home-guide-link">
            <a :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('appearance.homeReadGuide') }}<Icon name="arrowRight" size="sm" /></a>
          </div>
          <div class="credit-home-highlights">
            <span v-for="feature in features" :key="feature.title"><Icon :name="feature.icon" size="lg" />{{ t(feature.title) }}</span>
          </div>
        </div>

        <div class="credit-home-visual" role="img" :aria-label="t('appearance.homeProductPreview')">
          <div class="credit-home-glow credit-home-glow-purple" aria-hidden="true"></div>
          <div class="credit-home-glow credit-home-glow-blue" aria-hidden="true"></div>
          <div class="credit-home-card-scene" aria-hidden="true">
            <div class="credit-home-access-card">
              <div class="credit-home-card-brand"><Icon name="chart" size="lg" /><span>{{ siteName }}</span><span class="credit-home-demo-badge">{{ t('appearance.homeDemoData') }}</span></div>
              <div class="credit-home-card-bottom">
                <div>
                  <p>{{ t('appearance.homeTokenTotal') }}</p>
                  <div class="credit-home-token-count">
                    <strong><AnimatedNumber :value="demoTokens" :formatter="formatTokens" integer data-testid="credit-token-total" /></strong>
                    <span v-if="tokenUpdate > 0" :key="tokenUpdate" class="credit-home-token-rise">+{{ formatTokens(tokenGain) }}</span>
                  </div>
                </div>
                <span class="credit-home-card-seal"></span>
              </div>
            </div>
            <div class="credit-home-floating-card">
              <span class="credit-home-floating-icon"><Icon name="trendingUp" size="lg" /></span>
              <div><p>{{ t('appearance.homeTokenGain') }}</p><strong data-testid="credit-token-gain">+ <AnimatedNumber :value="tokenGain" :formatter="formatTokens" integer /> Token</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section id="credit-home-features" class="credit-home-features" :aria-label="t('appearance.homeFeatures')">
        <article v-for="feature in features" :key="feature.title" class="credit-home-feature">
          <span class="credit-home-feature-icon"><Icon :name="feature.icon" size="lg" /></span>
          <h2>{{ t(feature.title) }}</h2>
          <p>{{ t(feature.description) }}</p>
        </article>
      </section>
    </main>

    <footer class="credit-home-footer">
      <span>&copy; {{ new Date().getFullYear() }} {{ siteName }}</span>
      <a href="https://github.com/Wei-Shaw/sub2api" target="_blank" rel="noopener noreferrer">GitHub<Icon name="externalLink" size="sm" /></a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import AnimatedNumber from '@/components/custom/AnimatedNumber.vue'

const props = defineProps<{
  siteName: string
  siteLogo: string
  siteSubtitle: string
  docUrl: string
  isAuthenticated: boolean
  dashboardPath: string
  showModelPlazaEntry: boolean
  isDark: boolean
}>()
defineEmits<{ 'toggle-theme': [] }>()
const { t } = useI18n()
const destination = computed(() => props.isAuthenticated ? props.dashboardPath : '/login')
const demoTokens = ref(1284560)
const tokenGain = ref(240)
const tokenUpdate = ref(0)
const formatTokens = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format
let tokenTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  tokenTimer = setInterval(() => {
    if (document.hidden || motion.matches) return
    tokenGain.value = 120 + Math.floor(Math.random() * 861)
    demoTokens.value += tokenGain.value
    tokenUpdate.value++
  }, 4000)
})
onUnmounted(() => clearInterval(tokenTimer))
const features = [
  { icon: 'server', title: 'appearance.featureAccess', description: 'appearance.homeAccessDescription' },
  { icon: 'chart', title: 'appearance.featureUsage', description: 'appearance.homeUsageDescription' },
  { icon: 'shield', title: 'appearance.featureKeys', description: 'appearance.homeKeysDescription' },
] as const
</script>

<style scoped>
.credit-home { min-height: 100svh; overflow: clip; background: var(--credit-background); color: var(--credit-foreground); }
.credit-home-header, .credit-home-main, .credit-home-footer { width: min(1280px, 100% - 48px); margin-inline: auto; }
.credit-home-header { min-height: 80px; display: flex; align-items: center; justify-content: space-between; gap: 24px; position: relative; z-index: 2; }
.credit-home-brand { min-width: 0; display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; letter-spacing: -.025em; }
.credit-home-brand img { width: 30px; height: 30px; flex-shrink: 0; object-fit: contain; border-radius: 8px; }
.credit-home-brand span { overflow-wrap: anywhere; }
.credit-home-nav { display: flex; align-items: center; flex-shrink: 0; gap: 12px; }
.credit-home-doc, .credit-home-theme { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; color: var(--credit-muted-foreground); font-size: 13px; border-radius: 999px; transition: color 160ms, background-color 160ms; }
.credit-home-doc { padding: 8px; }
.credit-home-theme { width: 40px; }
.credit-home-doc:hover, .credit-home-theme:hover { background: var(--credit-muted); color: var(--credit-foreground); }
.credit-home-header .credit-home-login { border-radius: 999px; padding-inline: 18px; }
.credit-home-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: 80px; min-height: calc(100svh - 80px); padding: 64px 0 96px; }
.credit-home-copy { min-width: 0; position: relative; z-index: 1; }
.credit-home-copy h1 { margin: 0 0 24px; font-size: clamp(42px, 4.4vw, 60px); font-weight: 800; line-height: 1.1; letter-spacing: -.035em; overflow-wrap: anywhere; }
.credit-home-name, .credit-home-headline { display: block; }
.credit-home-headline { color: var(--credit-accent); text-wrap: balance; white-space: pre-line; margin-top: 6px; }
.credit-home-description { max-width: 560px; color: var(--credit-muted-foreground); font-size: 16px; line-height: 1.75; text-wrap: pretty; overflow-wrap: anywhere; animation: credit-home-rise .8s .15s both; }
.credit-home-description > span { display: block; }
.credit-home-copy h1 { animation: credit-home-rise .8s .05s both; }
.credit-home-actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 38px; animation: credit-home-rise .8s .25s both; }
.credit-home-actions .btn { min-height: 44px; padding: 11px 24px; gap: 10px; border-radius: 999px; font-size: 14px; font-weight: 600; transition: background-color 160ms, box-shadow 200ms, transform 200ms; }
.credit-home-actions .btn-secondary { background: var(--credit-muted); border-color: transparent; box-shadow: none; }
.credit-home-actions .btn-secondary:hover { background: var(--credit-border); }
.credit-home-actions .btn-primary { background: #6f63f6; box-shadow: 0 6px 18px #6f63f61a; }
.credit-home-actions .btn-primary:hover { background: #6355ef; box-shadow: 0 8px 24px #6f63f633; }
.credit-home-actions .btn:active { transform: scale(.96); }
.credit-home-guide-link { margin-top: 20px; font-size: 12px; color: var(--credit-muted-foreground); }
.credit-home-guide-link a { display: inline-flex; align-items: center; gap: 6px; }
.credit-home-guide-link a:hover { color: var(--credit-accent); }
.credit-home-highlights { margin-top: 64px; padding-top: 32px; border-top: 1px solid color-mix(in srgb, var(--credit-border) 65%, transparent); display: flex; flex-wrap: wrap; gap: 28px; color: var(--credit-muted-foreground); font-size: 13px; animation: credit-home-rise .8s .4s both; }
.credit-home-highlights > span { display: inline-flex; align-items: center; gap: 8px; }
.credit-home-highlights > span:nth-child(1) svg { color: #e9a008; }
.credit-home-highlights > span:nth-child(2) svg { color: #3b82f6; }
.credit-home-highlights > span:nth-child(3) svg { color: #22c55e; }
.credit-home-visual { position: relative; min-width: 0; height: 500px; display: flex; align-items: flex-start; justify-content: center; padding-top: 24px; }
.credit-home-glow { position: absolute; width: 280px; height: 280px; border-radius: 50%; filter: blur(64px); pointer-events: none; animation: credit-home-glow 6s ease-in-out infinite alternate; }
.credit-home-glow-purple { background: #b46bfa4d; right: 48px; top: 24px; }
.credit-home-glow-blue { background: #609fff4d; left: 60px; bottom: 32px; animation-delay: -3s; }
.credit-home-card-scene { position: relative; width: min(100% - 40px, 448px); animation: credit-home-card-enter 1s .2s both; }
.credit-home-access-card { height: 256px; border-radius: 24px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; background: color-mix(in srgb, var(--credit-background) 40%, transparent); border: 1px solid #ffffff1a; backdrop-filter: blur(24px); box-shadow: 0 28px 46px -14px #18181b45; transition: transform 500ms; }
.credit-home-access-card:hover { transform: scale(1.02); }
.credit-home-card-brand { display: flex; align-items: center; gap: 16px; font-size: 16px; }
.credit-home-card-brand span { overflow-wrap: anywhere; }
.credit-home-card-brand .credit-home-demo-badge { flex-shrink: 0; border: 1px solid color-mix(in srgb, var(--credit-border) 70%, transparent); border-radius: 999px; padding: 4px 8px; color: var(--credit-muted-foreground); font-size: 10px; line-height: 1.2; }
.credit-home-card-bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.credit-home-card-bottom p { font-size: 14px; color: var(--credit-muted-foreground); margin-bottom: 6px; }
.credit-home-card-bottom strong { font-family: 'Geist Mono', monospace; font-weight: 600; font-size: 34px; letter-spacing: -.05em; line-height: 1.15; }
.credit-home-token-count { position: relative; width: max-content; font-variant-numeric: tabular-nums; }
.credit-home-token-rise { position: absolute; right: 0; top: -18px; color: #16a34a; font: 600 13px 'Geist Mono', monospace; letter-spacing: 0; animation: credit-token-rise 1.2s ease-out both; }
.credit-home-card-seal { width: 32px; height: 32px; border-radius: 50%; background: #6f63f6; flex-shrink: 0; }
.credit-home-floating-card { position: absolute; top: -24px; right: -24px; display: flex; align-items: center; gap: 12px; min-width: 176px; border-radius: 16px; padding: 16px; background: color-mix(in srgb, var(--credit-background) 60%, transparent); border: 1px solid #ffffff33; backdrop-filter: blur(20px); box-shadow: 0 16px 24px -12px #18181b40; animation: credit-home-float 4s ease-in-out infinite; }
.credit-home-floating-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #22c55e26; color: #16a34a; }
.credit-home-floating-card p { color: var(--credit-muted-foreground); font-size: 12px; margin-bottom: 2px; }
.credit-home-floating-card strong { font-size: 14px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.credit-home-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 48px; padding: 80px 0 96px; scroll-margin-top: 32px; }
.credit-home-feature-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; color: var(--credit-accent); background: var(--credit-selected); margin-bottom: 24px; }
.credit-home-feature h2 { font-size: 20px; font-weight: 600; letter-spacing: -.025em; }
.credit-home-feature p { margin-top: 12px; max-width: 34ch; font-size: 14px; line-height: 1.9; color: var(--credit-muted-foreground); overflow-wrap: anywhere; }
.credit-home-footer { padding-block: 28px; display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 12px; color: var(--credit-muted-foreground); }
.credit-home-footer > span { overflow-wrap: anywhere; }
.credit-home-footer a { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.credit-home-footer a:hover { color: var(--credit-foreground); }
@keyframes credit-home-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes credit-home-card-enter { from { opacity: 0; transform: translateX(40px) rotate(-5deg); } to { opacity: 1; transform: none; } }
@keyframes credit-home-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
@keyframes credit-home-glow { from { opacity: .65; } to { opacity: 1; } }
@keyframes credit-token-rise { 0% { opacity: 0; transform: translateY(8px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-24px); } }
@media (prefers-reduced-motion: reduce) { .credit-home-token-rise { display: none; } }
@media (max-width: 1100px) {
  .credit-home-hero { gap: 40px; }
  .credit-home-copy h1 { font-size: 46px; }
  .credit-home-highlights { gap: 16px; }
}
@media (max-width: 900px) {
  .credit-home-header, .credit-home-main, .credit-home-footer { width: calc(100% - 48px); }
  .credit-home-hero { grid-template-columns: 1fr; gap: 56px; padding: 64px 0 24px; min-height: auto; }
  .credit-home-copy { max-width: 620px; }
  .credit-home-visual { width: 100%; max-width: 520px; margin-inline: auto; height: 380px; padding-top: 40px; }
  .credit-home-glow-blue { bottom: 0; }
  .credit-home-features { gap: 28px; padding-block: 48px 64px; }
}
@media (max-width: 639px) {
  .credit-home-header, .credit-home-main, .credit-home-footer { width: calc(100% - 40px); }
  .credit-home-header { min-height: 76px; gap: 12px; }
  .credit-home-nav { gap: 4px; }
  .credit-home-theme { width: 44px; min-height: 44px; }
  .credit-home-doc { display: none; }
  .credit-home-brand { font-size: 14px; gap: 8px; }
  .credit-home-brand img { width: 28px; height: 28px; }
  .credit-home-header .credit-home-login { min-height: 44px; padding-inline: 12px; }
  .credit-home-hero { padding-top: 44px; gap: 52px; }
  .credit-home-copy h1 { font-size: clamp(34px, 9.4vw, 44px); margin-bottom: 24px; }
  .credit-home-description { font-size: 14px; }
  .credit-home-actions { margin-top: 28px; gap: 12px; }
  .credit-home-actions .btn { padding-inline: 20px; }
  .credit-home-highlights { margin-top: 36px; padding-top: 24px; gap: 16px 20px; font-size: 12px; }
  .credit-home-highlights svg { width: 18px; height: 18px; }
  .credit-home-visual { height: 300px; padding-top: 32px; }
  .credit-home-card-scene { width: calc(100% - 32px); }
  .credit-home-access-card { height: 212px; padding: 22px; border-radius: 24px; }
  .credit-home-card-bottom strong { font-size: clamp(26px, 7.5vw, 34px); }
  .credit-home-floating-card { right: -16px; top: -56px; padding: 12px; gap: 10px; }
  .credit-home-floating-icon { width: 36px; height: 36px; }
  .credit-home-glow { width: 200px; height: 200px; filter: blur(48px); }
  .credit-home-features { grid-template-columns: 1fr; gap: 40px; }
  .credit-home-feature-icon { margin-bottom: 16px; }
  .credit-home-feature h2 { font-size: 18px; }
  .credit-home-feature p { max-width: none; }
}
@media (max-width: 359px) {
  .credit-home-header { flex-wrap: wrap; padding-block: 16px; }
  .credit-home-nav { margin-left: auto; }
  .credit-home-hero { padding-top: 32px; }
}
</style>
