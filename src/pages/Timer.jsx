import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Square, RotateCcw, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

export default function Timer({ session }) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [subject, setSubject] = useState('Coding')
  const [isSaving, setIsSaving] = useState(false)
  const subjects = ['Coding', 'Math', 'Reading', 'Writing', 'Other']

  const startTimeRef = useRef(null)
  const accumulatedTimeRef = useRef(0)
  const intervalRef = useRef(null)

  // Load state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('timerState')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        setSubject(parsed.subject || 'Coding')
        accumulatedTimeRef.current = parsed.accumulatedTime || 0

        if (parsed.isRunning) {
          startTimeRef.current = parsed.startTime
          setIsRunning(true)

          const now = Date.now()
          const currentElapsed = Math.floor((now - parsed.startTime) / 1000) + parsed.accumulatedTime
          setElapsedSeconds(currentElapsed)
        } else {
          setElapsedSeconds(parsed.accumulatedTime || 0)
        }
      } catch (e) {
        console.error("Error parsing timer state", e)
      }
    }
  }, [])

  // Interval for updating UI
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
            const now = Date.now()
            const currentElapsed = Math.floor((now - startTimeRef.current) / 1000) + accumulatedTimeRef.current
            setElapsedSeconds(currentElapsed)
        }
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning])

  const saveState = (running, start, accumulated, subj) => {
    localStorage.setItem('timerState', JSON.stringify({
        isRunning: running,
        startTime: start,
        accumulatedTime: accumulated,
        subject: subj
    }))
  }

  const handleStart = () => {
    const now = Date.now()
    startTimeRef.current = now
    setIsRunning(true)
    saveState(true, now, accumulatedTimeRef.current, subject)
  }

  const handlePause = () => {
    const now = Date.now()
    if (startTimeRef.current) {
        const added = Math.floor((now - startTimeRef.current) / 1000)
        accumulatedTimeRef.current += added
        startTimeRef.current = null
        setElapsedSeconds(accumulatedTimeRef.current)
    }
    setIsRunning(false)
    saveState(false, null, accumulatedTimeRef.current, subject)
  }

  const handleReset = () => {
    setIsRunning(false)
    setElapsedSeconds(0)
    accumulatedTimeRef.current = 0
    startTimeRef.current = null
    localStorage.removeItem('timerState')
  }

  const handleFinish = async () => {
    if (elapsedSeconds < 1) return

    setIsSaving(true)
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))

    try {
      const { error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: session.user.id,
          subject: subject,
          duration_minutes: durationMinutes,
          created_at: new Date().toISOString()
        })

      if (error) throw error

      // Success
      alert(`Session saved! ${durationMinutes} minutes of ${subject}.`)
      handleReset()
    } catch (error) {
      console.error('Error saving session:', error)
      alert('Failed to save session. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubjectChange = (e) => {
      const newSubject = e.target.value
      setSubject(newSubject)
      saveState(isRunning, startTimeRef.current, accumulatedTimeRef.current, newSubject)
  }

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 animate-in fade-in duration-500">
      {/* Subject Selector */}
      <div className="relative">
        <select
          value={subject}
          onChange={handleSubjectChange}
          disabled={isRunning}
          className={cn(
            "appearance-none bg-neutral-800 border border-neutral-700 text-white py-3 px-8 pr-12 rounded-full text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-opacity",
            isRunning && "opacity-50 cursor-not-allowed"
          )}
        >
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
      </div>

      {/* Timer Display */}
      <div className="relative">
        <div className={cn(
            "text-7xl sm:text-9xl font-mono font-bold tracking-wider text-white tabular-nums transition-colors duration-300",
            isRunning ? "text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.3)]" : "text-neutral-200"
        )}>
            {formatTime(elapsedSeconds)}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-6">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="group flex items-center justify-center w-24 h-24 bg-indigo-600 rounded-full hover:bg-indigo-500 hover:scale-105 transition-all duration-200 shadow-xl shadow-indigo-900/30 ring-4 ring-neutral-900"
            aria-label="Start Timer"
          >
            <Play className="w-10 h-10 text-white ml-1 fill-current" />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="group flex items-center justify-center w-24 h-24 bg-neutral-700 rounded-full hover:bg-neutral-600 hover:scale-105 transition-all duration-200 shadow-xl shadow-black/30 ring-4 ring-neutral-900"
            aria-label="Pause Timer"
          >
            <Pause className="w-10 h-10 text-white fill-current" />
          </button>
        )}
      </div>

      {/* Secondary Controls */}
      <div className={cn(
          "flex items-center space-x-8 transition-all duration-300 transform",
          (!isRunning && elapsedSeconds > 0) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <button
            onClick={handleReset}
            disabled={isSaving}
            className="flex flex-col items-center space-y-2 text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-50"
        >
            <div className="p-3 bg-neutral-800 rounded-full border border-neutral-700">
                <RotateCcw className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Reset</span>
        </button>

        <button
            onClick={handleFinish}
            disabled={isSaving}
            className="flex flex-col items-center space-y-2 text-neutral-400 hover:text-green-400 transition-colors disabled:opacity-50"
        >
            <div className="p-3 bg-neutral-800 rounded-full border border-neutral-700">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
            </div>
            <span className="text-xs font-medium">Finish</span>
        </button>
      </div>
    </div>
  )
}
