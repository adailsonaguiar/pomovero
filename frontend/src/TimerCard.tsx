import { PomodoroMode } from './usePomodoro';

interface TimerCardProps {
  timeLeft: number;
  totalDuration: number;
  isActive: boolean;
  currentMode: PomodoroMode;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

const CIRC = 2 * Math.PI * 120;

const MODE_COLORS: Record<PomodoroMode, string> = {
  focus: '#ff6a4d',
  short: '#4dd0e1',
  long: '#7aa2ff',
};

export function TimerCard({ timeLeft, totalDuration, isActive, currentMode, onStart, onPause, onReset }: TimerCardProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const color = MODE_COLORS[currentMode];
  const offset = totalDuration > 0 ? CIRC * (1 - timeLeft / totalDuration) : 0;

  return (
    <section className="timer-section">
      <div className="timer-wrap">
        <div className="timer-glow" style={{ background: color }} />
        <svg className="timer-svg" viewBox="0 0 264 264">
          <circle className="track" cx="132" cy="132" r="120" fill="none" strokeWidth="12" strokeLinecap="round" />
          <circle
            className="progress"
            cx="132"
            cy="132"
            r="120"
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ stroke: color, filter: `drop-shadow(0 0 8px ${color}88)` }}
          />
        </svg>
        <div className="timer-display">
          <span className="time" style={{ color, textShadow: `0 0 30px ${color}66` }}>
            {formatTime(timeLeft)}
          </span>
          <span className="status">{isActive ? 'Em andamento' : 'Pronto para focar'}</span>
        </div>
      </div>

      <div className="controls">
        <button className="ctrl-sm" onClick={onReset} aria-label="Reset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 1 9 9" />
            <path d="M3 5v7h7" />
          </svg>
        </button>
        <button
          className="ctrl-main"
          onClick={isActive ? onPause : onStart}
          aria-label={isActive ? 'Pause' : 'Start'}
          style={{ background: color, boxShadow: `0 10px 30px ${color}73, inset 0 1px 0 rgba(255,255,255,0.2)` }}
        >
          {isActive ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <button className="ctrl-sm" aria-label="Skip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4l10 8-10 8V4z" />
            <path d="M19 5v14" />
          </svg>
        </button>
      </div>
    </section>
  );
}
