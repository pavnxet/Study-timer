import { startOfDay, subDays, isSameDay, format, isAfter, isBefore } from 'date-fns'

/**
 * Aggregate duration by subject for Donut Chart
 * @param {Array} sessions
 * @returns {Array} [{ name: 'Math', value: 120 }, ...]
 */
export function getSubjectDistribution(sessions) {
  const distribution = {}
  sessions.forEach(s => {
    const subject = s.subject || 'Unknown'
    distribution[subject] = (distribution[subject] || 0) + (s.duration_minutes || 0)
  })

  return Object.entries(distribution).map(([name, value]) => ({ name, value }))
}

/**
 * Calculate Focus Velocity
 * Compare average daily minutes of last 7 days vs previous 7 days.
 * @param {Array} sessions
 * @returns {Object} { velocity: number, currentAvg: number, previousAvg: number, trendData: Array }
 */
export function getFocusVelocity(sessions) {
  const today = startOfDay(new Date())
  const sevenDaysAgo = subDays(today, 7)
  const fourteenDaysAgo = subDays(today, 14)

  let currentTotal = 0
  let previousTotal = 0

  // Rolling 7-Day Trend Data for Chart
  const trendData = []
  for (let i = 6; i >= 0; i--) {
      const day = subDays(today, i)
      const dateStr = format(day, 'MM/dd')

      const dayTotal = sessions
        .filter(s => isSameDay(new Date(s.created_at), day))
        .reduce((acc, s) => acc + (s.duration_minutes || 0), 0)

      trendData.push({ date: dateStr, minutes: dayTotal })
  }

  sessions.forEach(s => {
    const date = new Date(s.created_at)
    const minutes = s.duration_minutes || 0

    if (isAfter(date, sevenDaysAgo) || isSameDay(date, sevenDaysAgo)) {
        if (isBefore(date, today) || isSameDay(date, today)) { // Within last 7 days inclusive
            currentTotal += minutes
        }
    } else if (isAfter(date, fourteenDaysAgo) || isSameDay(date, fourteenDaysAgo)) {
        previousTotal += minutes
    }
  })

  const currentAvg = currentTotal / 7
  const previousAvg = previousTotal / 7

  let velocity = 0
  if (previousAvg > 0) {
      velocity = ((currentAvg - previousAvg) / previousAvg) * 100
  } else if (currentAvg > 0) {
      velocity = 100 // Infinite growth from 0
  }

  return {
      velocity: Math.round(velocity),
      currentAvg: Math.round(currentAvg),
      previousAvg: Math.round(previousAvg),
      trendData
  }
}

/**
 * Bin sessions by duration for Histogram
 * @param {Array} sessions
 * @returns {Array} [{ name: 'Sprint', count: 5 }, ...]
 */
export function getSessionLengthDistribution(sessions) {
  const bins = {
      'Sprint (<25m)': 0,
      'Standard (25-50m)': 0,
      'Deep Work (50-90m)': 0,
      'Marathon (>90m)': 0
  }

  sessions.forEach(s => {
      const m = s.duration_minutes || 0
      if (m < 25) bins['Sprint (<25m)']++
      else if (m < 50) bins['Standard (25-50m)']++
      else if (m < 90) bins['Deep Work (50-90m)']++
      else bins['Marathon (>90m)']++
  })

  return Object.entries(bins).map(([name, count]) => ({ name, count }))
}

/**
 * Process Heatmap Data with Subject Breakdown
 * @param {Array} sessions
 * @returns {Array} [{ date: '2023-01-01', count: 60, details: { Math: 30, Coding: 30 } }]
 */
export function getHeatmapData(sessions) {
  const map = new Map()

  sessions.forEach(s => {
      const dateStr = format(new Date(s.created_at), 'yyyy-MM-dd')
      const minutes = s.duration_minutes || 0
      const subject = s.subject || 'Other'

      if (!map.has(dateStr)) {
          map.set(dateStr, { count: 0, details: {} })
      }

      const entry = map.get(dateStr)
      entry.count += minutes
      entry.details[subject] = (entry.details[subject] || 0) + minutes
  })

  return Array.from(map.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      details: data.details
  }))
}
