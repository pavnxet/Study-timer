import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Square, RotateCcw, ChevronDown, Loader2, Timer as TimerIcon, Coffee, Brain, Settings, X, Plus, Trash2 } from 'lucide-react'
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

  // Settings State
  const [subjects, setSubjects] = useState(['Coding', 'Math', 'Reading', 'Writing', 'Other'])
  const [pomodoroSettings, setPomodoroSettings] = useState({ work: 25, shortBreak: 5, longBreak: 15 })
  const [showSettings, setShowSettings] = useState(false)

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
      subjects: [],
      pomodoro: { work: 25, shortBreak: 5, longBreak: 15 }
  })

  const startTimeRef = useRef(null)
  const accumulatedTimeRef = useRef(0)
  const intervalRef = useRef(null)

  const { saveSession, fetchSettings, updateSettings } = useStudyData()

  // Load Settings
  useEffect(() => {
      const load = async () => {
          const data = await fetchSettings()
          if (data.settings) {
              if (data.settings.subjects && data.settings.subjects.length > 0) {
                  setSubjects(data.settings.subjects)
              }
              if (data.settings.pomodoro) {
                  setPomodoroSettings(data.settings.pomodoro)
                  // If we are not running, update remaining seconds based on new settings?
                  // Only if we haven't started.
              }
          }
      }
      load()
  }, [fetchSettings])

  // Load Timer State on mount
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
            setRemainingSeconds(parsed.remainingSeconds ?? (pomodoroSettings.work * 60))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const sendNotification = (title, body) => {
      if (Notification.permission === 'granted') {
          new Notification(title, { body })
      }
  }

  const handlePomodoroComplete = async () => {
      clearInterval(intervalRef.current)
      setIsRunning(false)
      startTimeRef.current = null
      accumulatedTimeRef.current = 0 // Reset accumulated for next phase

      if (pomodoroPhase === 'work') {
          // Save Session
          setIsSaving(true)
          const result = await saveSession({
              subject: subject,
              duration_minutes: pomodoroSettings.work
          })

          if (result.newAchievements && result.newAchievements.length > 0) {
              alert(`🏆 Achievement Unlocked: ${result.newAchievements.join(', ')}`)
          }

          setIsSaving(false)

          const newSets = pomodoroSets + 1
          setPomodoroSets(newSets)

          // Determine next break
          if (newSets % 4 === 0) {
              setPomodoroPhase('longBreak')
              setRemainingSeconds(pomodoroSettings.longBreak * 60)
              sendNotification("Long Break Time!", `You've done 4 sets. Take ${pomodoroSettings.longBreak} minutes.`)
          } else {
              setPomodoroPhase('shortBreak')
              setRemainingSeconds(pomodoroSettings.shortBreak * 60)
              sendNotification("Break Time!", `Good job! Take ${pomodoroSettings.shortBreak} minutes.`)
          }
      } else {
          // Break is over
          setPomodoroPhase('work')
          setRemainingSeconds(pomodoroSettings.work * 60)
          sendNotification("Back to Work!", "Break is over. Ready to focus?")
      }
      // Note: We don't save paused state here because it's an auto-transition.
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
                const delta = Math.floor((now - startTimeRef.current) / 1000)
                const currentElapsedInPhase = delta + accumulatedTimeRef.current

                let duration = pomodoroSettings.work * 60
                if (pomodoroPhase === 'shortBreak') duration = pomodoroSettings.shortBreak * 60
                if (pomodoroPhase === 'longBreak') duration = pomodoroSettings.longBreak * 60

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, mode, pomodoroPhase, pomodoroSettings])


  const handleStart = () => {
      if (mode === 'pomodoro' && Notification.permission === 'default') {
          Notification.requestPermission()
      }

      const now = Date.now()
      startTimeRef.current = now
      setIsRunning(true)
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
               let duration = pomodoroSettings.work * 60
               if (pomodoroPhase === 'shortBreak') duration = pomodoroSettings.shortBreak * 60
               if (pomodoroPhase === 'longBreak') duration = pomodoroSettings.longBreak * 60
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
          if (pomodoroPhase === 'work') setRemainingSeconds(pomodoroSettings.work * 60)
          else if (pomodoroPhase === 'shortBreak') setRemainingSeconds(pomodoroSettings.shortBreak * 60)
          else setRemainingSeconds(pomodoroSettings.longBreak * 60)
      }
  }

  const handleModeToggle = () => {
      const newMode = mode === 'stopwatch' ? 'pomodoro' : 'stopwatch'
      setMode(newMode)
      handleReset()
      // Manually set initial state for new mode
      setIsRunning(false)
      startTimeRef.current = null
      accumulatedTimeRef.current = 0
      localStorage.removeItem('timerState')

      if (newMode === 'stopwatch') {
          setElapsedSeconds(0)
      } else {
          setPomodoroPhase('work')
          setRemainingSeconds(pomodoroSettings.work * 60)
      }
  }

  const handleFinish = async () => {
    if (mode === 'pomodoro') {
        handleReset()
        return
    }
    if (elapsedSeconds < 1) return

    setIsSaving(true)
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))

    const result = await saveSession({
        subject: subject,
        duration_minutes: durationMinutes
    })

    if (result && result.success) {
      alert(`Session saved! ${durationMinutes} minutes of ${subject}.`)
      if (result.newAchievements && result.newAchievements.length > 0) {
          alert(`🏆 Achievement Unlocked: ${result.newAchievements.join(', ')}`)
      }
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

  // Settings Logic
  const openSettings = () => {
      setSettingsForm({
          subjects: [...subjects],
          pomodoro: { ...pomodoroSettings }
      })
      setShowSettings(true)
  }

  const saveSettings = async () => {
      const newSettings = {
          subjects: settingsForm.subjects,
          pomodoro: settingsForm.pomodoro
      }
      await updateSettings(newSettings)
      setSubjects(newSettings.subjects)
      setPomodoroSettings(newSettings.pomodoro)

      // If user current subject is removed, reset to first available
      if (!newSettings.subjects.includes(subject) && newSettings.subjects.length > 0) {
          setSubject(newSettings.subjects[0])
      }

      setShowSettings(false)

      // Reset timer if needed (optional, but good if durations changed)
      if (!isRunning && mode === 'pomodoro') {
          // If we are in pomodoro and not running, update displayed time to match new settings
           if (pomodoroPhase === 'work') setRemainingSeconds(newSettings.pomodoro.work * 60)
           else if (pomodoroPhase === 'shortBreak') setRemainingSeconds(newSettings.pomodoro.shortBreak * 60)
           else setRemainingSeconds(newSettings.pomodoro.longBreak * 60)
      }
  }

  const addSubject = () => {
      setSettingsForm(prev => ({ ...prev, subjects: [...prev.subjects, 'New Subject'] }))
  }

  const removeSubject = (index) => {
      const newSubs = settingsForm.subjects.filter((_, i) => i !== index)
      setSettingsForm(prev => ({ ...prev, subjects: newSubs }))
  }

  const updateSubjectName = (index, val) => {
      const newSubs = [...settingsForm.subjects]
      newSubs[index] = val
      setSettingsForm(prev => ({ ...prev, subjects: newSubs }))
  }


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

      {/* Settings Button */}
      <button
        onClick={openSettings}
        className="absolute top-0 right-0 p-2 text-neutral-400 hover:text-white transition-colors"
        disabled={isRunning}
      >
          <Settings className="w-6 h-6" />
      </button>

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
          {subjects.map((s, idx) => (
            <option key={`${s}-${idx}`} value={s}>{s}</option>
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
          (!isRunning && (elapsedSeconds > 0 || (mode === 'pomodoro' && remainingSeconds < pomodoroSettings.work * 60))) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
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

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-neutral-700 flex justify-between items-center bg-neutral-800/50">
                      <h3 className="font-semibold text-white">Timer Settings</h3>
                      <button onClick={() => setShowSettings(false)} className="text-neutral-400 hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 space-y-6 overflow-y-auto">

                      {/* Pomodoro Settings */}
                      <div className="space-y-3">
                          <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Pomodoro Durations (min)</h4>
                          <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1">
                                  <label className="text-xs text-neutral-400">Work</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={settingsForm.pomodoro.work}
                                    onChange={(e) => setSettingsForm(prev => ({...prev, pomodoro: {...prev.pomodoro, work: parseInt(e.target.value) || 25}}))}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500"
                                  />
                              </div>
                              <div className="space-y-1">
                                  <label className="text-xs text-neutral-400">Short Break</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={settingsForm.pomodoro.shortBreak}
                                    onChange={(e) => setSettingsForm(prev => ({...prev, pomodoro: {...prev.pomodoro, shortBreak: parseInt(e.target.value) || 5}}))}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500"
                                  />
                              </div>
                              <div className="space-y-1">
                                  <label className="text-xs text-neutral-400">Long Break</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={settingsForm.pomodoro.longBreak}
                                    onChange={(e) => setSettingsForm(prev => ({...prev, pomodoro: {...prev.pomodoro, longBreak: parseInt(e.target.value) || 15}}))}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500"
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Subjects Management */}
                      <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Subjects</h4>
                            <button onClick={addSubject} className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add
                            </button>
                          </div>
                          <div className="space-y-2">
                              {settingsForm.subjects.map((sub, idx) => (
                                  <div key={idx} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={sub}
                                        onChange={(e) => updateSubjectName(idx, e.target.value)}
                                        className="flex-1 bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <button
                                        onClick={() => removeSubject(idx)}
                                        className="text-neutral-500 hover:text-red-400 p-2"
                                        disabled={settingsForm.subjects.length <= 1}
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>

                  </div>
                  <div className="p-4 border-t border-neutral-700 bg-neutral-800/50">
                      <button
                        onClick={saveSettings}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors"
                      >
                          Save Settings
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}
