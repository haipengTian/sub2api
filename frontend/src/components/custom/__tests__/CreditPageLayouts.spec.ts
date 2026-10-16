import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(`src/${path}`, 'utf8')
const css = source('styles/custom/credit.css')

describe('Credit secondary page layout contracts', () => {
  it('lets profile and redeem use the shared content width without changing other skins', () => {
    expect(source('views/user/ProfileView.vue')).toContain('profile-page')
    expect(source('views/user/RedeemView.vue')).toContain('redeem-page')
    expect(css).toMatch(/html\[data-skin='credit'\] :is\(\.profile-page, \.redeem-page\)\s*\{[^}]*max-width: none/)
  })

  it('provides a compact balance strip, a form/help layout, and a stable scrolling history', () => {
    const page = source('views/user/RedeemView.vue')
    for (const hook of ['redeem-balance-strip', 'redeem-form-panel', 'redeem-info-panel', 'redeem-history-body']) {
      expect(page).toContain(hook)
      expect(css).toContain(`.${hook}`)
    }
    expect(css).toMatch(/\.redeem-history-body\s*\{[^}]*height: 360px/)
    expect(css).toContain('grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr)')
  })

  it('flattens profile nesting and separates security forms into responsive columns', () => {
    expect(source('views/user/ProfileView.vue')).toContain('profile-security-grid')
    expect(source('components/user/profile/ProfileInfoCard.vue')).toContain('profile-basics-field')
    expect(source('components/user/profile/ProfileIdentityBindingsSection.vue')).toContain('profile-binding-row')
    expect(css).toContain('.profile-basics-field')
    expect(css).toContain('.profile-security-grid')
  })

  it('adapts both monitor versions without removing their existing design-system classes', () => {
    expect(source('components/user/monitor/MonitorHero.vue')).toContain('monitor-hero-controls')
    expect(source('components/user/monitor/MonitorCardGrid.vue')).toContain('monitor-content')
    for (const path of ['views/user/ChannelStatusV2View.vue', 'features/channel-monitor-v2/RelayPulseMatrix.vue', 'features/channel-monitor-v2/MetricCell.vue']) {
      expect(source(path)).toContain('credit-monitor-panel')
      expect(source(path)).toContain('!rounded-3xl')
    }
    expect(css).toContain('.credit-monitor-panel')
    expect(css).toMatch(/\.channel-status-page \.monitor-toolbar\s*\{[^}]*flex-wrap: wrap/)
    expect(css).toMatch(/\.credit-monitor-matrix \.matrix-table\s*\{[^}]*width: max\(100%, 720px\)/)
    expect(css).toContain('.credit-monitor-matrix .matrix-row--with-tps { grid-template-columns:')
  })
})

describe('Credit billing and public page layouts', () => {
  it('organizes recharge and confirmation into responsive content and summary columns', () => {
    const page = source('views/user/PaymentView.vue')
    for (const hook of ['purchase-page', 'purchase-recharge', 'purchase-confirm', 'purchase-account', 'purchase-amount', 'purchase-methods', 'purchase-summary', 'purchase-submit']) {
      expect(page).toContain(hook)
      expect(css).toContain(`.${hook}`)
    }
    expect(css).toContain('grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr)')
    expect(page).toContain('v-if="tabs.length === 0" class="purchase-unavailable card')
  })

  it('gives subscriptions and settings explicit hooks without replacing their business actions', () => {
    for (const hook of ['subscriptions-page', 'subscription-panel', 'subscription-unlimited']) {
      expect(source('views/user/SubscriptionsView.vue')).toContain(hook)
      expect(css).toContain(`.${hook}`)
    }
    const settings = source('views/admin/SettingsView.vue')
    for (const hook of ['settings-page', 'settings-section', 'settings-save-bar']) {
      expect(settings).toContain(hook)
      expect(css).toContain(`.${hook}`)
    }
    expect(settings).toContain('@submit.prevent="saveSettings"')
    expect(css).toMatch(/\.settings-save-bar\s*\{[^}]*position: sticky/)
  })

  it('aligns standalone queries and embedded model listings with the shared tokens', () => {
    for (const [file, hook] of [
      ['views/KeyUsageView.vue', 'key-usage-page'],
      ['views/ModelPlazaView.vue', 'model-plaza-page'],
      ['components/modelPlaza/ModelPlazaContent.vue', 'model-plaza-content'],
      ['components/modelPlaza/PlazaFilterBar.vue', 'plaza-filters'],
      ['components/modelPlaza/PlazaGroupSection.vue', 'plaza-group-panel'],
    ]) {
      expect(source(file)).toContain(hook)
      expect(css).toContain(`.${hook}`)
    }
  })

  it('keeps payment states bounded and QR codes on a white scan surface', () => {
    expect(source('views/user/PaymentQRCodeView.vue')).toContain('payment-qr-page')
    expect(source('views/user/PaymentResultView.vue')).toContain('payment-result-page')
    expect(source('components/payment/PaymentStatusPanel.vue')).toContain('payment-status-panel')
    expect(css).toMatch(/\.payment-qr-surface\s*\{[^}]*background: #fff/)
    expect(css).toMatch(/:is\(\.payment-qr-page, \.payment-result-card, \.payment-status-panel\)\s*\{[^}]*max-width: 448px/)
  })
})
