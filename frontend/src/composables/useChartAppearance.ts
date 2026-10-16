import { usePreferredReducedMotion } from '@vueuse/core'
import { computed } from 'vue'
import type { ChartData, ChartOptions } from 'chart.js'
import { useAppearance } from './useAppearance'

type Kind = 'line' | 'bar' | 'doughnut'
const font = "'Inter', 'Noto Sans SC', sans-serif"
const mono = "'Geist Mono', 'Noto Sans SC', monospace"
// Keep series identities (errors, successes, other) while softening the old palette.
const palette: Record<string, [string, string]> = {
  '#3b82f6': ['#6f63f6', '#a59cff'], '#6366f1': ['#6f63f6', '#a59cff'],
  '#10b981': ['#139c91', '#5cc9b3'], '#22c55e': ['#139c91', '#5cc9b3'],
  '#f59e0b': ['#d7992f', '#e9bd65'], '#ef4444': ['#dc6477', '#f18c9d'],
  '#8b5cf6': ['#9570d5', '#c2a2f3'], '#ec4899': ['#c778aa', '#e6a1cd'],
  '#14b8a6': ['#4ea7a1', '#7bd2ca'], '#f97316': ['#d98c55', '#efb082'],
  '#84cc16': ['#92a45d', '#b7c784'], '#06b6d4': ['#4b9dbd', '#82c9e4'],
  '#0ea5e9': ['#4b9dbd', '#82c9e4'], '#a855f7': ['#ad83cf', '#d0a8ed'],
  '#94a3b8': ['#a1a1aa', '#71717a'], '#9ca3af': ['#a1a1aa', '#71717a'],
  '#6b7280': ['#71717a', '#a1a1aa'],
}
const rgbAliases: Record<string, string> = {
  'rgb(59,130,246)': '#3b82f6', 'rgb(16,185,129)': '#10b981',
  'rgb(168,85,247)': '#a855f7',
  'rgb(245,158,11)': '#f59e0b', 'rgb(239,68,68)': '#ef4444',
}

/** Presentation only: never mutate source datasets, callbacks, axes or Chart defaults. */
export function useChartAppearance() {
  const { isCredit, isDark } = useAppearance()
  const reducedMotion = usePreferredReducedMotion()
  // vue-chartjs merges options/datasets in place. Remount across this boundary
  // so Credit-only fields cannot leak into an original skin's chart defaults.
  const chartAppearanceKey = computed(() => isCredit.value ? 'credit' : 'original')

  function themeColor(color: string): string {
    if (!isCredit.value) return color
    const key = color.toLowerCase().replace(/\s/g, '')
    return palette[rgbAliases[key] || key]?.[isDark.value ? 1 : 0] || color
  }

  function colors(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(colors)
    return typeof value === 'string' ? themeColor(value) : value
  }

  function themeData<T extends Kind>(type: T, data: ChartData<T>): ChartData<T> {
    if (!isCredit.value) return data
    const datasets = data.datasets.map(source => {
      const dataset = {
        ...source,
        backgroundColor: colors(source.backgroundColor),
        borderColor: colors(source.borderColor),
        hoverBackgroundColor: colors(source.hoverBackgroundColor),
        hoverBorderColor: colors(source.hoverBorderColor),
      }
      if (type === 'doughnut') {
        return { ...dataset, borderColor: isDark.value ? '#111113' : '#ffffff', borderWidth: 3, borderRadius: 4, spacing: 2, hoverOffset: 4 }
      }
      if (type === 'bar') {
        return { ...dataset, borderRadius: 6, borderSkipped: false, maxBarThickness: 40 }
      }
      // Derive the area/point colors from the line, including legacy rgba fills.
      const lineColor = dataset.borderColor
      return {
        ...dataset,
        ...(typeof lineColor === 'string' && /^#[\da-f]{6}$/i.test(lineColor) ? {
          backgroundColor: `${lineColor}14`, pointBackgroundColor: lineColor,
          pointBorderColor: isDark.value ? '#111113' : '#ffffff',
        } : {}),
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 10,
      }
    })
    return { ...data, datasets } as ChartData<T>
  }

  function themeOptions<T extends Kind>(type: T, original: ChartOptions<T>): ChartOptions<T> {
    if (!isCredit.value) return original
    // These three chart kinds share Cartesian/tooltip presentation fields.
    const options = original as ChartOptions<'line'>
    const text = isDark.value ? '#a1a1aa' : '#71717a'
    const ink = isDark.value ? '#fafafa' : '#18181b'
    const border = isDark.value ? '#303036' : '#e8e8ec'
    const grid = isDark.value ? '#ffffff0c' : '#18181b0a'
    const legend = options.plugins?.legend
    const tooltip = options.plugins?.tooltip
    const scales = options.scales && Object.fromEntries(Object.entries(options.scales).map(([id, scale]) => [id, {
      ...scale,
      border: { ...scale?.border, display: false, dash: [3, 4] },
      grid: { ...scale?.grid, color: grid, ...(id.startsWith('x') ? { display: false } : {}) },
      ticks: { ...scale?.ticks, color: text, padding: 8, font: { ...scale?.ticks?.font, family: font, size: 12 } },
      title: { ...scale?.title, color: text, font: { family: font, size: 12 } },
    }]))
    return {
      ...original,
      color: text,
      font: { family: font, size: 12 },
      animation: reducedMotion.value === 'reduce' ? false : { duration: 350, easing: 'easeOutQuart' },
      transitions: reducedMotion.value === 'reduce'
        ? Object.fromEntries(['active', 'resize', 'show', 'hide', ...Object.keys(options.transitions || {})].map(key => [key, { animation: { duration: 0 } }]))
        : options.transitions,
      ...(type === 'doughnut' ? { cutout: '72%' } : { scales }),
      plugins: {
        ...options.plugins,
        legend: {
          ...legend,
          labels: { ...legend?.labels, color: text, font: { family: font, size: 12 }, boxWidth: 8, boxHeight: 8, padding: 18, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          ...tooltip,
          backgroundColor: isDark.value ? '#18181b' : '#ffffff',
          titleColor: ink, bodyColor: ink, footerColor: text, borderColor: border, borderWidth: 1,
          cornerRadius: 10, padding: 12, boxWidth: 8, boxHeight: 8, boxPadding: 5,
          titleFont: { family: font, size: 12, weight: 600 },
          bodyFont: { family: mono, size: 12 }, footerFont: { family: mono, size: 12 },
        },
      },
    } as ChartOptions<T>
  }

  return { themeData, themeOptions, themeColor, chartAppearanceKey }
}
