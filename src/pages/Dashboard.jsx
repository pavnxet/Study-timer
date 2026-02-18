import { useState, useEffect } from 'react'
import CalendarHeatmap from 'react-calendar-heatmap'
import 'react-calendar-heatmap/dist/styles.css'
import { subDays, startOfDay, startOfWeek, format, isSameDay, isAfter } from 'date-fns'
import { cn } from '../lib/utils'
import { useStudyData } from '../hooks/useStudyData'

export default function Dashboard() {
  const [stats, setStats] = useState({ today: 0, week: 0 })
  const [heatmapValues, setHeatmapValues] = useState([])
  const { fetchSessions, loading } = useStudyData()
  const token = localStorage.getItem('sync_token')

  useEffect(() => {
    async function loadData() {
        const data = await fetchSessions()

        // Calculate stats
        const now = new Date()
        const startOfToday = startOfDay(now)
        const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 }) // Monday start

        let todayMinutes = 0
        let weekMinutes = 0
        const heatmapMap = new Map()

        data.forEach(session => {
            const date = new Date(session.created_at)
            const minutes = session.duration_minutes || 0

            // Today
            if (isSameDay(date, now)) {
                todayMinutes += minutes
            }

            // Week
            if (isAfter(date, startOfThisWeek) || isSameDay(date, startOfThisWeek)) {
                weekMinutes += minutes
            }

            // Heatmap
            const dateStr = format(date, 'yyyy-MM-dd')
            if (heatmapMap.has(dateStr)) {
                heatmapMap.set(dateStr, heatmapMap.get(dateStr) + minutes)
            } else {
                heatmapMap.set(dateStr, minutes)
            }
        })

        const heatmapArray = Array.from(heatmapMap, ([date, count]) => ({ date, count }))

        setStats({ today: todayMinutes, week: weekMinutes })
        setHeatmapValues(heatmapArray)
    }

    loadData()
  }, [fetchSessions])

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-neutral-400 mt-1">
          {token
            ? `Synced Account: ${token.slice(0, 10)}...`
            : 'Local Guest Account (Data not synced)'}
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm hover:border-neutral-600 transition-colors">
          <div className="text-neutral-400 text-sm font-medium uppercase tracking-wider">Today</div>
          <div className="mt-2 text-3xl font-bold text-white">
            {loading ? '-' : Math.floor(stats.today / 60)}<span className="text-lg text-neutral-500 font-normal ml-1">h</span> <span className="text-2xl">{loading ? '-' : stats.today % 60}</span><span className="text-lg text-neutral-500 font-normal ml-1">m</span>
          </div>
        </div>
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm hover:border-neutral-600 transition-colors">
          <div className="text-neutral-400 text-sm font-medium uppercase tracking-wider">This Week</div>
          <div className="mt-2 text-3xl font-bold text-white">
            {loading ? '-' : Math.floor(stats.week / 60)}<span className="text-lg text-neutral-500 font-normal ml-1">h</span> <span className="text-2xl">{loading ? '-' : stats.week % 60}</span><span className="text-lg text-neutral-500 font-normal ml-1">m</span>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm overflow-hidden">
        <div className="text-neutral-400 text-sm font-medium uppercase tracking-wider mb-6">Consistency (Last Year)</div>
        <div className="overflow-x-auto pb-2">
            <div className="min-w-[600px]">
                <CalendarHeatmap
                    startDate={subDays(new Date(), 365)}
                    endDate={new Date()}
                    values={heatmapValues}
                    classForValue={(value) => {
                    if (!value || value.count === 0) {
                        return 'color-empty';
                    }
                    return `color-scale-${Math.min(Math.ceil(value.count / 30), 4)}`;
                    }}
                    tooltipDataAttrs={value => {
                    return {
                        'data-tip': value.date ? `${value.date}: ${value.count} minutes` : 'No study',
                    };
                    }}
                    showWeekdayLabels={true}
                    gutterSize={2}
                />
            </div>
        </div>
      </div>
    </div>
  )
}
