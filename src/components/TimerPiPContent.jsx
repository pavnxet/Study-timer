import { Play, Pause, Square } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TimerPiPContent({ time, phase, subject, isRunning, onToggle, onFinish, mode }) {

  const getPhaseLabel = () => {
    if (mode !== 'pomodoro') return subject;
    if (phase === 'work') return 'Focus';
    if (phase === 'shortBreak') return 'Short Break';
    if (phase === 'longBreak') return 'Long Break';
    return phase;
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full h-full bg-neutral-900 text-white select-none">
      {/* Subject / Context */}
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2 truncate max-w-[200px]">
        {mode === 'pomodoro' ? subject : 'Stopwatch'}
      </div>

      {/* Timer Display */}
      <div className={cn(
        "text-5xl font-mono font-bold tracking-wider tabular-nums mb-6 transition-colors duration-300",
        isRunning ? "text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.3)]" : "text-neutral-500",
        (mode === 'pomodoro' && phase !== 'work') && isRunning && "text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.3)]"
      )}>
        {time}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggle}
          className="group flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-all active:scale-95"
          aria-label={isRunning ? "Pause" : "Start"}
        >
          {isRunning ? (
            <Pause className="w-5 h-5 text-white fill-current" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5 fill-current" />
          )}
        </button>

        {mode === 'stopwatch' && (
          <button
            onClick={onFinish}
            className="group flex items-center justify-center w-12 h-12 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-all active:scale-95 text-neutral-400 hover:text-green-400"
            aria-label="Finish"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        )}
      </div>

      {/* Footer Info (Phase) */}
      <div className="mt-4 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
          {getPhaseLabel()}
      </div>
    </div>
  );
}
