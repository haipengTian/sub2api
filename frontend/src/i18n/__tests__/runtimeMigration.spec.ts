import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '../locales/en'
import zh from '../locales/zh'

describe('Vue I18n 11 runtime migration', () => {
  it('translates actual locales and switches between Chinese and English', () => {
    const { global } = createI18n({ legacy: false, locale: 'en', messages: { en, zh } })
    expect(global.t('payment.perMonth')).toBe('month')
    global.locale.value = 'zh'
    expect(global.t('payment.perMonth')).toBe(zh.payment.perMonth)
    expect(global.t('payment.perMonth')).not.toBe('month')
  })

  it('keeps interpolation, linked messages, plurals and escaped HTML parameters', () => {
    const { global } = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {
        base: 'Hello', linked: '@:base {name}',
        items: '{count} item | {count} items',
        html: '<p>{name}</p>'
      } },
      escapeParameter: true,
      warnHtmlMessage: false
    })
    expect(global.t('linked', { name: 'Muse' })).toBe('Hello Muse')
    expect(global.t('items', 2)).toBe('2 items')
    expect(global.t('html', { name: '<img src=x onerror=alert(1)>' })).not.toContain('<img')
  })
})
