import { useState, useEffect, useRef } from 'react'
import CalendarHeatmap from 'react-calendar-heatmap'
import 'react-calendar-heatmap/dist/styles.css'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { subDays, startOfDay, startOfWeek, format, isSameDay, isAfter } from 'date-fns'
import { Plus, Target, X, Calendar, Clock, BookOpen, TrendingUp, BarChart3, PieChart as PieChartIcon, Trophy, Flame, Share2, Crown } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar
} from 'recharts'
import { toPng } from 'html-to-image'
import { cn } from '../lib/utils'
import { useStudyData } from '../hooks/useStudyData'
import { getSubjectDistribution, getFocusVelocity, getSessionLengthDistribution, getHeatmapData } from '../lib/analytics'
import { calculateXP, calculateLevel, calculateStreak, calculateMomentum, getRewardForLevel, xpForNextLevel } from '../lib/gamification'

export default function Dashboard() {
  const [stats, setStats] = useState({ today: 0, week: 0 })
  const [heatmapValues, setHeatmapValues] = useState([])
  const [dailyGoal, setDailyGoal] = useState(120)
  const [isGoalEditing, setIsGoalEditing] = useState(false)

  // Analytics State
  const [subjectData, setSubjectData] = useState([])
  const [velocityData, setVelocityData] = useState({ velocity: 0, currentAvg: 0, previousAvg: 0, trendData: [] })
  const [sessionLengthData, setSessionLengthData] = useState([])

  // Gamification State
  const [gamification, setGamification] = useState({ xp: 0, level: 1, streak: 0, momentum: 0, reward: null })

  // Manual Entry State
  const [showModal, setShowModal] = useState(false)
  const [manualForm, setManualForm] = useState({
      subject: 'Coding',
      duration: 30,
      date: format(new Date(), 'yyyy-MM-dd')
  })
  const [isSaving, setIsSaving] = useState(false)

  const { fetchSessions, saveSession, loading, getUserName, getToken } = useStudyData()
  const ticketRef = useRef(null)

  const token = getToken()
  const userName = getUserName()

  const loadData = async () => {
    const data = await fetchSessions()

    // Calculate basic stats
    const now = new Date()
    const startOfToday = startOfDay(now)
    const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 })

    let todayMinutes = 0
    let weekMinutes = 0

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
    })

    setStats({ today: todayMinutes, week: weekMinutes })

    // Analytics Processing
    setHeatmapValues(getHeatmapData(data))
    setSubjectData(getSubjectDistribution(data))
    setVelocityData(getFocusVelocity(data))
    setSessionLengthData(getSessionLengthDistribution(data))

    // Gamification Processing
    const xp = calculateXP(data)
    const level = calculateLevel(xp)
    setGamification({
        xp,
        level,
        streak: calculateStreak(data),
        momentum: calculateMomentum(data),
        reward: getRewardForLevel(level)
    })
  }

  useEffect(() => {
    loadData()
    const savedGoal = localStorage.getItem('dailyGoal')
    if (savedGoal) setDailyGoal(parseInt(savedGoal, 10))
  }, [fetchSessions])

  const handleGoalChange = (e) => {
      const val = parseInt(e.target.value, 10)
      if (!isNaN(val) && val > 0) {
          setDailyGoal(val)
          localStorage.setItem('dailyGoal', val.toString())
      }
  }

  const handleManualSubmit = async (e) => {
      e.preventDefault()
      setIsSaving(true)

      const dateParts = manualForm.date.split('-')
      const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0)

      const success = await saveSession({
          subject: manualForm.subject,
          duration_minutes: parseInt(manualForm.duration, 10),
          created_at: dateObj.toISOString()
      })

      if (success) {
          await loadData()
          setShowModal(false)
          setManualForm({ subject: 'Coding', duration: 30, date: format(new Date(), 'yyyy-MM-dd') })
      } else {
          alert("Failed to save session.")
      }
      setIsSaving(false)
  }

  const handleShareTicket = async () => {
      if (!ticketRef.current) return
      try {
          const dataUrl = await toPng(ticketRef.current, { cacheBust: true, backgroundColor: '#171717' })
          const link = document.createElement('a')
          link.download = `study-ticket-${format(new Date(), 'yyyy-MM-dd')}.png`
          link.href = dataUrl
          link.click()
      } catch (err) {
          console.error('Failed to generate ticket', err)
          alert("Could not generate ticket. Please try again.")
      }
  }

  const progressPercentage = Math.min(100, Math.round((stats.today / dailyGoal) * 100))
  const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#94a3b8'];

  // XP Progress
  const currentLevelXpStart = Math.pow(gamification.level, 2) * 100
  const nextLevelXpStart = Math.pow(gamification.level + 1, 2) * 100
  const xpInLevel = gamification.xp - currentLevelXpStart
  const xpNeeded = nextLevelXpStart - currentLevelXpStart
  const xpProgress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100))

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto relative pb-20">

      {/* Header & Gamification Bar */}
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
                <p className="text-neutral-400 mt-1">
                {token && userName
                    ? `Welcome back, ${userName}`
                    : 'Local Guest Account'}
                </p>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleShareTicket}
                    className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg border border-neutral-700 transition-colors text-sm font-medium"
                >
                    <Share2 className="w-4 h-4" />
                    Share
                </button>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-900/20"
                >
                    <Plus className="w-4 h-4" />
                    Log Session
                </button>
            </div>
        </header>

        {/* Gamification Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Level Card */}
            <div className="bg-gradient-to-br from-indigo-900/50 to-neutral-800 p-6 rounded-xl border border-indigo-500/30 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">Current Level</div>
                        <div className="text-3xl font-black text-white flex items-center gap-2">
                            {gamification.level}
                            <Crown className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                        </div>
                        <div className="text-xs text-indigo-200/70 mt-1">
                            {gamification.reward?.type}: {gamification.reward?.desc.split(',')[0]}
                        </div>
                    </div>
                    <div className="text-right">
                         <div className="text-xs text-neutral-400 mb-1">XP Progress</div>
                         <div className="text-xl font-bold text-white">{xpInLevel} <span className="text-neutral-500 text-sm font-normal">/ {xpNeeded}</span></div>
                    </div>
                </div>
                <div className="mt-4 w-full bg-neutral-900/50 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)] transition-all duration-1000" style={{ width: `${xpProgress}%` }} />
                </div>
            </div>

            {/* Streak Card */}
            <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm flex flex-col justify-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Flame className="w-24 h-24" />
                 </div>
                 <div className="flex items-center gap-4 relative z-10">
                     <div className={cn("p-3 rounded-full", gamification.streak > 0 ? "bg-orange-500/20 text-orange-500" : "bg-neutral-700 text-neutral-400")}>
                         <Flame className={cn("w-8 h-8", gamification.streak > 0 && "fill-current animate-pulse")} />
                     </div>
                     <div>
                         <div className="text-3xl font-bold text-white">{gamification.streak} <span className="text-lg font-normal text-neutral-500">days</span></div>
                         <div className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Current Streak</div>
                     </div>
                 </div>
            </div>

            {/* Momentum Card */}
            <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm flex flex-col justify-center">
                 <div className="flex items-center gap-4">
                     <div className="p-3 rounded-full bg-blue-500/20 text-blue-400">
                         <TrendingUp className="w-8 h-8" />
                     </div>
                     <div>
                         <div className="text-3xl font-bold text-white">{gamification.momentum} <span className="text-lg font-normal text-neutral-500">/ 100</span></div>
                         <div className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Momentum Score</div>
                     </div>
                 </div>
            </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today / Goal Card */}
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
              <div className="text-neutral-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                  Today's Focus
                  {isGoalEditing ? (
                      <input
                        type="number"
                        value={dailyGoal}
                        onChange={handleGoalChange}
                        onBlur={() => setIsGoalEditing(false)}
                        autoFocus
                        className="w-16 bg-neutral-900 border border-neutral-600 rounded px-1 text-xs text-white"
                      />
                  ) : (
                      <span
                        onClick={() => setIsGoalEditing(true)}
                        className="text-neutral-600 hover:text-neutral-400 cursor-pointer text-xs flex items-center gap-1"
                        title="Edit Daily Goal"
                      >
                          / {dailyGoal}m <Target className="w-3 h-3" />
                      </span>
                  )}
              </div>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">
                {loading ? '-' : Math.floor(stats.today / 60)}<span className="text-lg text-neutral-500 font-normal">h</span> {loading ? '-' : stats.today % 60}<span className="text-lg text-neutral-500 font-normal">m</span>
            </span>
            <span className={cn("text-sm font-medium", progressPercentage >= 100 ? "text-green-400" : "text-indigo-400")}>
                {progressPercentage}%
            </span>
          </div>

          <div className="mt-4 w-full bg-neutral-700 h-2 rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-1000 ease-out", progressPercentage >= 100 ? "bg-green-500" : "bg-indigo-500")}
                style={{ width: `${progressPercentage}%` }}
              />
          </div>
        </div>

        {/* Weekly Card */}
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm hover:border-neutral-600 transition-colors">
          <div className="text-neutral-400 text-sm font-medium uppercase tracking-wider">This Week</div>
          <div className="mt-2 text-4xl font-bold text-white">
            {loading ? '-' : Math.floor(stats.week / 60)}<span className="text-lg text-neutral-500 font-normal ml-1">h</span> <span className="text-2xl">{loading ? '-' : stats.week % 60}</span><span className="text-lg text-neutral-500 font-normal ml-1">m</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Subject Distribution */}
          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm min-h-[300px] flex flex-col">
              <h3 className="text-neutral-400 text-sm font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4" /> Subject Distribution
              </h3>
              <div className="flex-1 w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={subjectData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                          >
                              {subjectData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <RechartsTooltip
                              contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', color: '#fff' }}
                              itemStyle={{ color: '#fff' }}
                          />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Focus Velocity */}
          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm min-h-[300px] flex flex-col">
              <div className="flex justify-between items-start mb-4">
                  <h3 className="text-neutral-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Focus Velocity
                  </h3>
                  <div className={cn(
                      "text-sm font-bold px-2 py-1 rounded bg-neutral-900 border",
                      velocityData.velocity >= 0 ? "text-green-400 border-green-900" : "text-red-400 border-red-900"
                  )}>
                      {velocityData.velocity > 0 ? '+' : ''}{velocityData.velocity}%
                  </div>
              </div>

              <div className="flex-1 w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={velocityData.trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#404040" vertical={false} />
                          <XAxis dataKey="date" stroke="#737373" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#737373" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <RechartsTooltip
                              contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', color: '#fff' }}
                          />
                          <Line type="monotone" dataKey="minutes" stroke="#818cf8" strokeWidth={3} dot={{fill: '#818cf8', r: 4}} activeDot={{r: 6}} />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Session Length Distribution */}
          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-sm min-h-[300px] flex flex-col lg:col-span-2">
              <h3 className="text-neutral-400 text-sm font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Session Stamina
              </h3>
              <div className="flex-1 w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sessionLengthData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#404040" vertical={false} />
                          <XAxis dataKey="name" stroke="#737373" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#737373" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                          <RechartsTooltip
                              cursor={{fill: '#262626'}}
                              contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', color: '#fff' }}
                          />
                          <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} barSize={60} />
                      </BarChart>
                  </ResponsiveContainer>
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
                        if (!value || !value.date) return null;

                        let tip = `${value.date}: ${value.count} min`;
                        if (value.details) {
                            Object.entries(value.details).forEach(([sub, min]) => {
                                tip += `\n${sub}: ${min}m`;
                            });
                        }

                        return {
                            'data-tooltip-id': 'heatmap-tooltip',
                            'data-tooltip-content': tip,
                        };
                    }}
                    showWeekdayLabels={true}
                    gutterSize={2}
                />
                <ReactTooltip
                    id="heatmap-tooltip"
                    style={{ backgroundColor: "#171717", border: "1px solid #404040", zIndex: 50, whiteSpace: "pre-wrap" }}
                />
            </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="p-4 border-b border-neutral-700 flex justify-between items-center bg-neutral-800/50">
                      <h3 className="font-semibold text-white">Log Past Session</h3>
                      <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
                      <div className="space-y-2">
                          <label className="text-xs font-medium text-neutral-400 uppercase">Subject</label>
                          <div className="relative">
                              <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                              <select
                                value={manualForm.subject}
                                onChange={e => setManualForm({...manualForm, subject: e.target.value})}
                                className="w-full bg-neutral-900 border border-neutral-600 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                              >
                                  {['Coding', 'Math', 'Reading', 'Writing', 'Other'].map(s => (
                                      <option key={s} value={s}>{s}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <label className="text-xs font-medium text-neutral-400 uppercase">Date</label>
                              <div className="relative">
                                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                  <input
                                    type="date"
                                    value={manualForm.date}
                                    max={format(new Date(), 'yyyy-MM-dd')}
                                    onChange={e => setManualForm({...manualForm, date: e.target.value})}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                  />
                              </div>
                          </div>
                          <div className="space-y-2">
                              <label className="text-xs font-medium text-neutral-400 uppercase">Duration (min)</label>
                              <div className="relative">
                                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                  <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    value={manualForm.duration}
                                    onChange={e => setManualForm({...manualForm, duration: e.target.value})}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                  />
                              </div>
                          </div>
                      </div>

                      <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                              {isSaving ? 'Saving...' : 'Add Session'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Hidden Study Ticket for Export */}
      <div
        ref={ticketRef}
        className="fixed top-0 left-[-9999px] w-[350px] bg-neutral-100 text-neutral-900 p-6 font-mono shadow-xl"
        style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '10px 10px' }}
      >
        <div className="border-2 border-neutral-900 p-4 relative">
             <div className="text-center border-b-2 border-neutral-900 pb-4 mb-4">
                 <h2 className="text-2xl font-black uppercase tracking-tighter">Study Receipt</h2>
                 <p className="text-xs uppercase tracking-widest text-neutral-500">{format(new Date(), 'MMM dd, yyyy • hh:mm a')}</p>
             </div>

             <div className="space-y-3 mb-6">
                 <div className="flex justify-between text-sm">
                     <span className="font-bold">STUDENT</span>
                     <span className="uppercase">{userName || 'Guest'}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                     <span className="font-bold">LEVEL</span>
                     <span>{gamification.level}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                     <span className="font-bold">STREAK</span>
                     <span>{gamification.streak} DAYS</span>
                 </div>
                 <div className="border-t border-dashed border-neutral-400 my-2"></div>
                 <div className="flex justify-between text-lg font-black">
                     <span>TOTAL FOCUS</span>
                     <span>{stats.today} MIN</span>
                 </div>
             </div>

             <div className="text-center mt-8">
                 <div className="inline-block border-2 border-neutral-900 px-3 py-1 text-xs font-bold uppercase rotate-[-3deg]">
                     Verified Focus
                 </div>
                 <p className="mt-4 text-[10px] text-neutral-500 uppercase">Minimalist Study Tracker</p>
             </div>

             {/* Jagged Edge Effect (Visual CSS trick) */}
             <div className="absolute -bottom-6 left-0 right-0 h-4 bg-transparent"
                  style={{
                      background: 'linear-gradient(45deg, transparent 33.333%, #f5f5f5 33.333%, #f5f5f5 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #f5f5f5 33.333%, #f5f5f5 66.667%, transparent 66.667%)',
                      backgroundSize: '10px 20px',
                      backgroundPosition: '0 10px'
                  }}
             />
        </div>
      </div>
    </div>
  )
}
