<template>
  <section class="modern-admin-overview" :aria-label="t('appearance.adminWorkspace')">
    <div class="modern-admin-heading">
      <div>
        <p class="modern-admin-eyebrow">{{ t('appearance.adminSection') }}</p>
        <h2>{{ t('appearance.adminWorkspace') }}</h2>
        <p class="modern-admin-description">{{ t('appearance.adminDescription') }}</p>
      </div>
      <p v-if="stats" data-testid="admin-account-summary" class="modern-admin-summary" :class="{ 'modern-admin-summary-warning': stats.error_accounts > 0 }">
        {{ t('appearance.adminAccountSummary', { active: stats.normal_accounts, total: stats.total_accounts, errors: stats.error_accounts }) }}
      </p>
    </div>
    <div class="modern-admin-actions" :class="{ 'modern-admin-actions-simple': simpleMode }">
      <RouterLink v-for="item in links" :key="item.path" :to="item.path" class="modern-admin-action" :class="item.tone">
        <div class="flex items-center justify-between gap-3">
          <Icon :name="item.icon" size="lg" />
          <Icon name="arrowRight" size="sm" />
        </div>
        <div>
          <strong>{{ t(item.label) }}</strong>
          <small>{{ t(item.description) }}</small>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { DashboardStats } from '@/types'

const props = withDefaults(defineProps<{
  simpleMode?: boolean
  stats?: Pick<DashboardStats, 'normal_accounts' | 'total_accounts' | 'error_accounts'> | null
}>(), { simpleMode: false, stats: null })
const { t } = useI18n()
const links = computed(() => [
  { path: '/admin/accounts', label: 'nav.accounts', description: 'appearance.adminAccountsDescription', icon: 'server' as const, tone: 'modern-admin-action-green' },
  ...(!props.simpleMode ? [{ path: '/admin/users', label: 'nav.users', description: 'appearance.adminUsersDescription', icon: 'users' as const, tone: 'modern-admin-action-black' }] : []),
  { path: '/admin/groups', label: 'nav.groups', description: 'appearance.adminGroupsDescription', icon: 'grid' as const, tone: '' },
  { path: '/admin/settings', label: 'nav.settings', description: 'appearance.adminSettingsDescription', icon: 'cog' as const, tone: '' }
])
</script>
