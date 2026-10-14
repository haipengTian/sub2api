<template>
  <section>
    <div class="modern-dashboard-intro">
      <h2>{{ t('appearance.greeting', { name: name || 'Sub2API' }) }}</h2>
      <p>{{ t('appearance.todaySummary', { requests, cost: cost.toFixed(2) }) }}</p>
    </div>
    <div class="modern-action-band" :class="{ 'modern-action-band-simple': isSimple, 'modern-action-band-no-payment': !isSimple && !paymentEnabled }">
      <div v-if="!isSimple" data-testid="welcome-balance" class="modern-action-tile modern-action-tile-green">
        <span>{{ t('dashboard.balance') }}</span>
        <span class="modern-balance-number">$<AnimatedNumber :value="balance" :formatter="balanceFormatter.format" /></span>
        <small>{{ t('common.available') }}</small>
      </div>
      <router-link v-if="paymentEnabled && !isSimple" to="/purchase" data-testid="welcome-payment" class="modern-action-tile modern-action-tile-green">
        <Icon name="plus" size="lg" />
        <div><strong>{{ purchaseLabel }}</strong><small>{{ t('appearance.purchaseDescription') }}</small></div>
      </router-link>
      <router-link to="/keys" class="modern-action-tile modern-action-tile-black">
        <Icon name="key" size="lg" />
        <div><strong>{{ t('dashboard.createApiKey') }}</strong><small>{{ t('dashboard.generateNewKey') }}</small></div>
      </router-link>
      <button type="button" data-testid="copy-endpoint" class="modern-action-tile" @click="copyToClipboard(endpoint)">
        <Icon name="link" size="lg" />
        <div><strong>{{ t('appearance.copyEndpoint') }}</strong><small>{{ endpoint }}</small></div>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'
import { resolveSiteBillingMode } from '@/utils/siteBillingMode'
import AnimatedNumber from './AnimatedNumber.vue'

defineProps<{ name: string; balance: number; requests: number; cost: number; isSimple: boolean }>()
const { t } = useI18n()
// Same precision and rounding as the classic balance card.
const balanceFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()
const endpoint = computed(() => appStore.apiBaseUrl || window.location.origin)
const paymentEnabled = computed(() => resolveFeatureFlag(appStore.cachedPublicSettings, FeatureFlags.payment))
const purchaseLabel = computed(() => {
  const mode = resolveSiteBillingMode(appStore.cachedPublicSettings)
  return t(mode === 'recharge_only' ? 'nav.recharge' : mode === 'subscription_only' ? 'nav.subscribe' : 'nav.buySubscription')
})
</script>
