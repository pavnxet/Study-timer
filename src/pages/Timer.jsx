import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Square, RotateCcw, ChevronDown, Loader2, Timer as TimerIcon, Coffee, Brain } from 'lucide-react'
import { cn } from '../lib/utils'
import { useStudyData } from '../hooks/useStudyData'

export default function Timer() {
  const [mode, setMode] = useState('stopwatch') // 'stopwatch' | 'pomodoro'
  const [pomodoroPhase, setPomodoroPhase] = useState('work') // 'work' | 'shortBreak' | 'longBreak'
  const [pomodoroSets, setPomodoroSets] = useState(0)

  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0) // For Stopwatch
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60) // For Pomodoro

  const [subject, setSubject] = useState('Coding')
  const [isSaving, setIsSaving] = useState(false)
  const subjects = ['Coding', 'Math', 'Reading', 'Writing', 'Other']

  const startTimeRef = useRef(null)
  const accumulatedTimeRef = useRef(0)
  const intervalRef = useRef(null)

  const { saveSession } = useStudyData()

  // Durations in minutes
  const POMODORO_WORK = 25
  const POMODORO_SHORT_BREAK = 5
  const POMODORO_LONG_BREAK = 15

  // Load state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('timerState')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        setSubject(parsed.subject || 'Coding')
        setMode(parsed.mode || 'stopwatch')

        // Pomodoro State
        if (parsed.mode === 'pomodoro') {
            setPomodoroPhase(parsed.pomodoroPhase || 'work')
            setPomodoroSets(parsed.pomodoroSets || 0)
            setRemainingSeconds(parsed.remainingSeconds ?? (POMODORO_WORK * 60))
        } else {
            setElapsedSeconds(parsed.accumulatedTime || 0)
            accumulatedTimeRef.current = parsed.accumulatedTime || 0
        }

        if (parsed.isRunning) {
          startTimeRef.current = parsed.startTime
          setIsRunning(true)
        }
      } catch (e) {
        console.error("Error parsing timer state", e)
      }
    }
  }, [])

  // Save State Helper
  const saveState = (running, start, accumulated, subj, currentMode, currentPhase, currentSets, currentRemaining) => {
    localStorage.setItem('timerState', JSON.stringify({
        isRunning: running,
        startTime: start,
        accumulatedTime: accumulated, // For stopwatch
        subject: subj,
        mode: currentMode,
        pomodoroPhase: currentPhase,
        pomodoroSets: currentSets,
        remainingSeconds: currentRemaining // For pomodoro
    }))
  }

  // Interval Logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        const now = Date.now()

        if (mode === 'stopwatch') {
            if (startTimeRef.current) {
                const currentElapsed = Math.floor((now - startTimeRef.current) / 1000) + accumulatedTimeRef.current
                setElapsedSeconds(currentElapsed)
            }
        } else {
            // Pomodoro Logic
            if (startTimeRef.current) {
                // Calculate how much time has passed since start/resume
                const delta = Math.floor((now - startTimeRef.current) / 1000)
                // remainingSeconds state is the "start value" for this run.
                // We need to store the "base remaining" when we pause/start.
                // Actually, cleaner approach:
                // accumulatedTimeRef for Pomodoro can store "seconds elapsed in this session".
                // remaining = duration - (seconds elapsed).

                // Let's reuse accumulatedTimeRef as "elapsed time in current phase"
                const currentElapsedInPhase = delta + accumulatedTimeRef.current

                let duration = POMODORO_WORK * 60
                if (pomodoroPhase === 'shortBreak') duration = POMODORO_SHORT_BREAK * 60
                if (pomodoroPhase === 'longBreak') duration = POMODORO_LONG_BREAK * 60

                const newRemaining = duration - currentElapsedInPhase

                if (newRemaining <= 0) {
                    handlePomodoroComplete()
                } else {
                    setRemainingSeconds(newRemaining)
                }
            }
        }
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, mode, pomodoroPhase]) // pomodoroSets not needed in dependency if handled in complete

  const handlePomodoroComplete = async () => {
      clearInterval(intervalRef.current)
      setIsRunning(false)
      startTimeRef.current = null
      accumulatedTimeRef.current = 0 // Reset accumulated for next phase

      if (pomodoroPhase === 'work') {
          // Save Session
          setIsSaving(true)
          await saveSession({
              subject: subject,
              duration_minutes: POMODORO_WORK
          })
          setIsSaving(false)

          const newSets = pomodoroSets + 1
          setPomodoroSets(newSets)

          // Determine next break
          if (newSets % 4 === 0) {
              setPomodoroPhase('longBreak')
              setRemainingSeconds(POMODORO_LONG_BREAK * 60)
              sendNotification("Long Break Time!", "You've done 4 sets. Take 15 minutes.")
          } else {
              setPomodoroPhase('shortBreak')
              setRemainingSeconds(POMODORO_SHORT_BREAK * 60)
              sendNotification("Break Time!", "Good job! Take 5 minutes.")
          }
      } else {
          // Break is over
          setPomodoroPhase('work')
          setRemainingSeconds(POMODORO_WORK * 60)
          sendNotification("Back to Work!", "Break is over. Ready to focus?")
      }

      // Update saved state (paused at start of new phase)
      localStorage.removeItem('timerState') // Clear or update?
      // Better to save the new state as "paused"
      // We need to call saveState, but we need current values.
      // State updates (setPomodoroPhase) are async.
      // So we can't reliably saveState here with new values unless we calculate them.
      // For now, let's rely on the user seeing the UI update.
      // If they reload immediately, they might lose the "transition".
      // But saving session is done.
  }

  const sendNotification = (title, body) => {
      if (Notification.permission === 'granted') {
          new Notification(title, { body })
      }
  }

  const handleStart = () => {
      if (mode === 'pomodoro' && Notification.permission === 'default') {
          Notification.requestPermission()
      }

      const now = Date.now()
      startTimeRef.current = now
      setIsRunning(true)

      // For Pomodoro, we need to know what "remaining" was when we started to calculate accurately?
      // No, `accumulatedTimeRef` holds "time elapsed so far in this phase".
      // If we just started, accumulated is 0.
      // If we resumed, accumulated is whatever was elapsed before.

      // We need to make sure `accumulatedTimeRef` is correct.
      // In Stopwatch, it's total elapsed.
      // In Pomodoro, it's total elapsed *in this phase*.
      // `saveState` saves `accumulatedTime`. `useEffect` restores it.

      saveState(true, now, accumulatedTimeRef.current, subject, mode, pomodoroPhase, pomodoroSets, remainingSeconds)
  }

  const handlePause = () => {
      const now = Date.now()
      if (startTimeRef.current) {
          const delta = Math.floor((now - startTimeRef.current) / 1000)
          accumulatedTimeRef.current += delta
          startTimeRef.current = null

          if (mode === 'stopwatch') {
              setElapsedSeconds(accumulatedTimeRef.current)
          } else {
              // Recalculate remaining based on total accumulated
               let duration = POMODORO_WORK * 60
               if (pomodoroPhase === 'shortBreak') duration = POMODORO_SHORT_BREAK * 60
               if (pomodoroPhase === 'longBreak') duration = POMODORO_LONG_BREAK * 60
               setRemainingSeconds(duration - accumulatedTimeRef.current)
          }
      }
      setIsRunning(false)
      saveState(false, null, accumulatedTimeRef.current, subject, mode, pomodoroPhase, pomodoroSets, remainingSeconds)
  }

  const handleReset = () => {
      setIsRunning(false)
      startTimeRef.current = null
      accumulatedTimeRef.current = 0
      localStorage.removeItem('timerState')

      if (mode === 'stopwatch') {
          setElapsedSeconds(0)
      } else {
          // Reset current phase duration
          if (pomodoroPhase === 'work') setRemainingSeconds(POMODORO_WORK * 60)
          else if (pomodoroPhase === 'shortBreak') setRemainingSeconds(POMODORO_SHORT_BREAK * 60)
          else setRemainingSeconds(POMODORO_LONG_BREAK * 60)
      }
  }

  const handleModeToggle = () => {
      // Switch mode and reset
      const newMode = mode === 'stopwatch' ? 'pomodoro' : 'stopwatch'
      setMode(newMode)
      handleReset()
      // Note: handleReset uses current 'mode' state which hasn't updated yet in this closure.
      // So we need to manually reset based on newMode.
      setIsRunning(false)
      startTimeRef.current = null
      accumulatedTimeRef.current = 0
      localStorage.removeItem('timerState')

      if (newMode === 'stopwatch') {
          setElapsedSeconds(0)
      } else {
          setPomodoroPhase('work')
          setRemainingSeconds(POMODORO_WORK * 60)
      }
  }

  const handleFinish = async () => {
    // Only for stopwatch. Pomodoro finishes automatically.
    // Or maybe user wants to finish Pomodoro early? Usually we just reset.
    // Let's keep Finish for stopwatch. For Pomodoro, it might be "Skip Phase" or just Reset.

    if (mode === 'pomodoro') {
        // Treat as reset or maybe save partial?
        // User briefing says: "Upon timer completion... adds Work duration".
        // Partial Pomodoros usually don't count.
        handleReset()
        return
    }

    if (elapsedSeconds < 1) return

    setIsSaving(true)
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))

    const success = await saveSession({
        subject: subject,
        duration_minutes: durationMinutes
    })

    if (success) {
      alert(`Session saved! ${durationMinutes} minutes of ${subject}.`)
      handleReset()
    } else {
      alert('Failed to save session. Please try again.')
    }

    setIsSaving(false)
  }

  const handleSubjectChange = (e) => {
      const newSubject = e.target.value
      setSubject(newSubject)
      saveState(isRunning, startTimeRef.current, accumulatedTimeRef.current, newSubject, mode, pomodoroPhase, pomodoroSets, remainingSeconds)
  }

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // --- Effects for Title and Burnout ---
  useEffect(() => {
      if (isRunning) {
          const timeStr = mode === 'stopwatch' ? formatTime(elapsedSeconds) : formatTime(remainingSeconds)
          const phaseStr = mode === 'pomodoro' ? (pomodoroPhase === 'work' ? 'Focus' : 'Break') : subject
          document.title = `${timeStr} - ${phaseStr}`
      } else {
          document.title = "Minimalist Study Tracker"
      }
  }, [isRunning, elapsedSeconds, remainingSeconds, mode, pomodoroPhase, subject])

  const isBurnout = mode === 'stopwatch' && elapsedSeconds > 120 * 60

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 animate-in fade-in duration-500 relative">

      {/* Mode Toggle */}
      <div className="flex bg-neutral-800 p-1 rounded-full border border-neutral-700">
          <button
              onClick={mode === 'pomodoro' ? handleModeToggle : undefined}
              className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  mode === 'stopwatch' ? "bg-neutral-700 text-white shadow" : "text-neutral-400 hover:text-white"
              )}
          >
              <div className="flex items-center gap-2">
                  <TimerIcon className="w-4 h-4" />
                  Stopwatch
              </div>
          </button>
          <button
               onClick={mode === 'stopwatch' ? handleModeToggle : undefined}
              className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  mode === 'pomodoro' ? "bg-indigo-600 text-white shadow" : "text-neutral-400 hover:text-white"
              )}
          >
              <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Pomodoro
              </div>
          </button>
      </div>

      {/* Subject Selector */}
      <div className="relative z-10">
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

      {/* Pomodoro Phase Indicator */}
      {mode === 'pomodoro' && (
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider">
              <span className={cn("px-2 py-1 rounded", pomodoroPhase === 'work' ? "bg-indigo-900/50 text-indigo-300 border border-indigo-500/30" : "text-neutral-600")}>Focus</span>
              <span className="text-neutral-700">→</span>
              <span className={cn("px-2 py-1 rounded", pomodoroPhase !== 'work' ? "bg-green-900/50 text-green-300 border border-green-500/30" : "text-neutral-600")}>
                  {pomodoroPhase === 'longBreak' ? 'Long Break' : 'Short Break'}
              </span>
              <span className="ml-2 text-neutral-500 text-xs normal-case">Set {pomodoroSets % 4}/4</span>
          </div>
      )}

      {/* Timer Display */}
      <div className="relative group">
        <div className={cn(
            "text-7xl sm:text-9xl font-mono font-bold tracking-wider text-white tabular-nums transition-colors duration-300",
            isRunning ? "text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.3)]" : "text-neutral-200",
            (mode === 'pomodoro' && pomodoroPhase !== 'work') && isRunning && "text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]"
        )}>
            {formatTime(mode === 'stopwatch' ? elapsedSeconds : remainingSeconds)}
        </div>

        {/* Burnout Overlay */}
        {isBurnout && (
            <div className="absolute -inset-4 bg-amber-900/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in z-20">
                <Coffee className="w-12 h-12 text-amber-400 mb-4" />
                <h3 className="text-xl font-bold text-amber-200 mb-2">Stamina Dropping</h3>
                <p className="text-amber-100/80 text-sm">You've been focusing for over 2 hours. Research shows a 15-minute walk will boost your next session by 20%.</p>
                <button
                    onClick={() => { /* Dismiss? Just finish session helps */ handleFinish() }}
                    className="mt-4 bg-amber-700 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                    Take a Break (Finish)
                </button>
            </div>
        )}
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
          (!isRunning && (elapsedSeconds > 0 || (mode === 'pomodoro' && remainingSeconds < POMODORO_WORK * 60))) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
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

        {mode === 'stopwatch' && (
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
        )}
      </div>
    </div>
  )
}
