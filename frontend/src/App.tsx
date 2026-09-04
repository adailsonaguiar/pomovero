import { useState } from 'react';
import { TimerCard } from './TimerCard';
import { usePomodoro, PomodoroMode } from './usePomodoro';
import { InsightsView } from './InsightsView';
import { RecentSessions } from './RecentSessions';
import { SettingsView } from './SettingsView';

const MODES: { id: PomodoroMode; label: string }[] = [
  { id: 'focus', label: 'Foco' },
  { id: 'short', label: 'Pausa curta' },
  { id: 'long', label: 'Pausa longa' },
];

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const {
    timeLeft,
    totalDuration,
    isActive,
    currentMode,
    startTimer,
    stopTimer,
    resetTimer,
    selectMode,
    focusDuration,
    breakDuration,
    longBreakDuration,
    longBreakInterval,
    startSoundEnabled,
    alarmSoundEnabled,
    updateSettings,
  } = usePomodoro();

  return (
    <div id="App">
      <div className="ambient" />

      <div className="container">
        <header>
          <div className="brand">
            <div className="icon-tile">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C9 2 6 4 6 7c0 1.5.5 2.8 1.4 3.8C5.5 12 4 14.5 4 17c0 3.3 2.7 6 6 6h4c3.3 0 6-2.7 6-6 0-2.5-1.5-5-3.4-6.2C17.5 9.8 18 8.5 18 7c0-3-3-5-6-5z" />
              </svg>
            </div>
            <div>
              <h1>Pomodoro</h1>
              <p>Focus timer</p>
            </div>
          </div>
          <button className="icon-btn" aria-label="Settings" onClick={() => setShowSettings(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        <div className="modes" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={currentMode === m.id ? 'active' : ''}
              onClick={() => selectMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <TimerCard
          timeLeft={timeLeft}
          totalDuration={totalDuration}
          isActive={isActive}
          currentMode={currentMode}
          onStart={() => startTimer(currentMode)}
          onPause={stopTimer}
          onReset={resetTimer}
        />

        <InsightsView />

        <RecentSessions />
      </div>

      {showSettings && (
        <SettingsView
          focusDuration={focusDuration}
          breakDuration={breakDuration}
          longBreakDuration={longBreakDuration}
          longBreakInterval={longBreakInterval}
          startSoundEnabled={startSoundEnabled}
          alarmSoundEnabled={alarmSoundEnabled}
          onSave={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
