import { runKeywordRadar } from '@/lib/keyword-radar'

declare global {
  var __keywordRadarSchedulerStarted: boolean | undefined
  var __keywordRadarSchedulerTimer: NodeJS.Timeout | undefined
}

export function ensureKeywordRadarScheduler() {
  if (globalThis.__keywordRadarSchedulerStarted) return
  globalThis.__keywordRadarSchedulerStarted = true

  const tick = () => {
    runKeywordRadar({ reason: 'scheduler' }).catch(() => {})
  }

  globalThis.__keywordRadarSchedulerTimer = setInterval(tick, 60 * 1000)
  globalThis.__keywordRadarSchedulerTimer.unref?.()
  queueMicrotask(tick)
}
