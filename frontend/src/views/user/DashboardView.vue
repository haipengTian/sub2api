<template>
  <AppLayout>
    <div class="relative space-y-6" :aria-busy="loading || loadingCharts || loadingUsage">
      <RefreshIndicator :active="loading && !!stats" />
      <LoadingPlaceholder v-if="loading && !stats && isModern" kind="dashboard" :is-simple="authStore.isSimpleMode" :payment-enabled="paymentEnabled" />
      <div v-else-if="loading && (!isModern || !stats)" class="flex items-center justify-center py-12"><LoadingSpinner /></div>
      <template v-else-if="stats">
        <DashboardWelcome v-if="isModern" :name="user?.username || ''" :balance="user?.balance || 0" :requests="stats.today_requests" :cost="stats.today_actual_cost" :is-simple="authStore.isSimpleMode" />
        <div class="dashboard-stats space-y-6"><UserDashboardStats :stats="stats" :balance="user?.balance || 0" :is-simple="authStore.isSimpleMode" :platform-quotas="platformQuotas" :hide-balance="isModern" /></div>
        <UserDashboardCharts class="dashboard-charts" v-model:startDate="startDate" v-model:endDate="endDate" v-model:granularity="granularity" :loading="loadingCharts" :refreshing="loading || loadingUsage || loadingQuotas" :resolved="chartsResolved" :trend="trendData" :models="modelStats" @dateRangeChange="loadCharts" @granularityChange="loadCharts" @refresh="refreshAll" />
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2"><UserDashboardRecentUsage :data="recentUsage" :loading="loadingUsage" :resolved="usageResolved" /></div>
          <div class="lg:col-span-1"><UserDashboardQuickActions /></div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'; import { useAuthStore } from '@/stores/auth'; import { usageAPI, type UserDashboardStats as UserStatsType } from '@/api/usage'
import AppLayout from '@/components/layout/AppLayout.vue'; import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import UserDashboardStats from '@/components/user/dashboard/UserDashboardStats.vue'; import UserDashboardCharts from '@/components/user/dashboard/UserDashboardCharts.vue'
import UserDashboardRecentUsage from '@/components/user/dashboard/UserDashboardRecentUsage.vue'; import UserDashboardQuickActions from '@/components/user/dashboard/UserDashboardQuickActions.vue'
import type { UsageLog, TrendDataPoint, ModelStat, PlatformQuotaItem } from '@/types'
import { getMyPlatformQuotas } from '@/api/user'
import { formatDateLocalInput } from '@/utils/format'
import DashboardWelcome from '@/components/custom/DashboardWelcome.vue'
import { useAppearance } from '@/composables/useAppearance'
import LoadingPlaceholder from '@/components/custom/LoadingPlaceholder.vue'
import RefreshIndicator from '@/components/custom/RefreshIndicator.vue'
import { useAppStore } from '@/stores/app'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'
const { isModern } = useAppearance()
const appStore = useAppStore()
const paymentEnabled = computed(() => resolveFeatureFlag(appStore.cachedPublicSettings, FeatureFlags.payment))

const authStore = useAuthStore(); const user = computed(() => authStore.user)
const stats = ref<UserStatsType | null>(null); const loading = ref(false); const loadingUsage = ref(false); const loadingCharts = ref(false)
const chartsResolved = ref(false); const usageResolved = ref(false); const loadingQuotas = ref(false)
const trendData = ref<TrendDataPoint[]>([]); const modelStats = ref<ModelStat[]>([]); const recentUsage = ref<UsageLog[]>([])
const platformQuotas = ref<PlatformQuotaItem[] | null>(null)

const startDate = ref(formatDateLocalInput(new Date(Date.now() - 6 * 86400000))); const endDate = ref(formatDateLocalInput(new Date())); const granularity = ref('day')

const loadStats = async () => { loading.value = true; try { await authStore.refreshUser(); stats.value = await usageAPI.getDashboardStats() } catch (error) { console.error('Failed to load dashboard stats:', error) } finally { loading.value = false } }
let chartsRequest = 0
const loadCharts = async () => {
  const request = ++chartsRequest
  loadingCharts.value = true
  try {
    const res = await Promise.all([usageAPI.getDashboardTrend({ start_date: startDate.value, end_date: endDate.value, granularity: granularity.value as any }), usageAPI.getDashboardModels({ start_date: startDate.value, end_date: endDate.value })])
    if (request !== chartsRequest) return
    trendData.value = res[0].trend || []; modelStats.value = res[1].models || []
  } catch (error) { if (request === chartsRequest) console.error('Failed to load charts:', error) }
  finally { if (request === chartsRequest) { chartsResolved.value = true; loadingCharts.value = false } }
}
const loadRecent = async () => { loadingUsage.value = true; try { const res = await usageAPI.getByDateRange(startDate.value, endDate.value); recentUsage.value = res.items.slice(0, 5) } catch (error) { console.error('Failed to load recent usage:', error) } finally { usageResolved.value = true; loadingUsage.value = false } }
const loadPlatformQuotas = async () => { loadingQuotas.value = true; try { const data = await getMyPlatformQuotas(); platformQuotas.value = data.platform_quotas ?? [] } catch (error) { console.warn('Failed to load platform quotas:', error); platformQuotas.value = [] } finally { loadingQuotas.value = false } }
const refreshAll = () => {
  if (loading.value || loadingCharts.value || loadingUsage.value || loadingQuotas.value) return
  loadStats(); loadCharts(); loadRecent(); loadPlatformQuotas()
}

onMounted(() => { refreshAll() })
</script>
