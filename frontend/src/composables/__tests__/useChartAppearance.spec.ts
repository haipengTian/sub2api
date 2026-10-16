import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ChartData, ChartOptions } from 'chart.js'
import { initAppearance, useAppearance } from '../useAppearance'
import { useChartAppearance } from '../useChartAppearance'

const motion = ref('no-preference')
vi.mock('@vueuse/core', () => ({ usePreferredReducedMotion: () => motion }))

beforeEach(() => {
  localStorage.setItem('sub2api-skin', 'credit')
  localStorage.setItem('theme', 'light')
  initAppearance()
  motion.value = 'no-preference'
})

describe('chart presentation contract', () => {
  it('preserves data, axis meaning, gaps, callbacks and zoom without mutating inputs', () => {
    const callback = vi.fn()
    const zoom = { pan: { enabled: true } }
    const dataset = Object.freeze({ label: 'ms', data: [12, null, 28], yAxisID: 'yTtft', fill: false, spanGaps: false, borderDash: [4, 3], borderColor: '#ef4444' })
    const data: ChartData<'line'> = { labels: ['a', 'b', 'c'], datasets: [dataset] }
    const options: ChartOptions<'line'> = {
      interaction: { intersect: false, mode: 'index' },
      scales: { yTtft: { min: 0, position: 'right', ticks: { callback }, grid: { drawOnChartArea: false } } },
      plugins: { tooltip: { callbacks: { label: callback }, itemSort: callback }, legend: { display: false } },
    }
    // Unknown plugin fields must survive the presentation pass too.
    Object.assign(options.plugins!, { zoom })
    Object.freeze(options)
    const { themeData, themeOptions } = useChartAppearance()
    const themed = themeData('line', data)
    expect(themed.datasets[0]).toMatchObject({ yAxisID: 'yTtft', fill: false, spanGaps: false, borderDash: [4, 3], borderColor: '#dc6477' })
    expect(themed.datasets[0].data).toBe(dataset.data)
    expect(data.datasets[0].borderColor).toBe('#ef4444')
    const result = themeOptions('line', options)
    expect(result.scales?.yTtft).toMatchObject({ min: 0, position: 'right', ticks: { callback }, grid: { drawOnChartArea: false } })
    expect(result.plugins?.tooltip?.callbacks?.label).toBe(callback)
    expect(result.plugins?.tooltip?.itemSort).toBe(callback)
    expect(result.plugins).toHaveProperty('zoom', zoom)
    expect(result.plugins?.legend?.display).toBe(false)
    expect(result.interaction).toBe(options.interaction)
  })

  it.each(['classic', 'modern'] as const)('returns original objects for %s', skin => {
    useAppearance().setSkin(skin)
    const { themeData, themeOptions, themeColor } = useChartAppearance()
    const data: ChartData<'bar'> = { datasets: [{ data: [4], backgroundColor: '#3b82f6' }] }
    const options: ChartOptions<'bar'> = { animation: false }
    expect(themeData('bar', data)).toBe(data)
    expect(themeOptions('bar', options)).toBe(options)
    expect(themeColor('#3b82f6')).toBe('#3b82f6')
  })

  it('keeps unknown colors and semantic categories, with responsive dark colors', () => {
    const { themeColor } = useChartAppearance()
    expect(themeColor('custom-color')).toBe('custom-color')
    expect(themeColor('#94a3b8')).toBe('#a1a1aa')
    expect(themeColor('rgb(239, 68, 68)')).toBe('#dc6477')
    expect(themeColor('#10b981')).toBe('#139c91')
    useAppearance().toggleDark()
    expect(themeColor('#ef4444')).toBe('#f18c9d')
    expect(themeColor('#10b981')).toBe('#5cc9b3')
  })

  it('rebuilds only at the Credit boundary, not on dark or motion changes', () => {
    const { chartAppearanceKey } = useChartAppearance()
    expect(chartAppearanceKey.value).toBe('credit')
    useAppearance().toggleDark()
    motion.value = 'reduce'
    expect(chartAppearanceKey.value).toBe('credit')
    useAppearance().setSkin('classic')
    expect(chartAppearanceKey.value).toBe('original')
    useAppearance().setSkin('modern')
    expect(chartAppearanceKey.value).toBe('original')
  })

  it('disables entry, hover and visibility animation when reduced motion is requested', () => {
    const { themeOptions } = useChartAppearance()
    motion.value = 'reduce'
    const options = themeOptions('line', { transitions: { active: { animation: { duration: 500 } } } })
    expect(options.animation).toBe(false)
    for (const key of ['active', 'resize', 'show', 'hide']) {
      expect(options.transitions?.[key]?.animation?.duration).toBe(0)
    }
    motion.value = 'no-preference'
    expect(themeOptions('line', {}).animation).toMatchObject({ duration: 350 })
  })
})
