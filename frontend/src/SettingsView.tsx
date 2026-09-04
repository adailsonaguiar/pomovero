import { useState } from 'react';

interface SettingsViewProps {
  focusDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  startSoundEnabled: boolean;
  alarmSoundEnabled: boolean;
  onSave: (
    focusSeconds: number,
    breakSeconds: number,
    longBreakSeconds: number,
    longBreakInterval: number,
    startSound: boolean,
    alarmSound: boolean
  ) => void;
  onClose: () => void;
}

export function SettingsView({
  focusDuration,
  breakDuration,
  longBreakDuration,
  longBreakInterval,
  startSoundEnabled,
  alarmSoundEnabled,
  onSave,
  onClose,
}: SettingsViewProps) {
  const [focusMin, setFocusMin] = useState(focusDuration / 60);
  const [breakMin, setBreakMin] = useState(breakDuration / 60);
  const [longBreakMin, setLongBreakMin] = useState(longBreakDuration / 60);
  const [interval, setInterval] = useState(longBreakInterval);
  const [startSound, setStartSound] = useState(startSoundEnabled);
  const [alarmSound, setAlarmSound] = useState(alarmSoundEnabled);

  const handleSave = () => {
    onSave(focusMin * 60, breakMin * 60, longBreakMin * 60, interval, startSound, alarmSound);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="glass settings-card" onClick={(e) => e.stopPropagation()}>
        <h2>Configurações</h2>

        <div className="settings-field">
          <label htmlFor="focusDuration">Foco (minutos)</label>
          <input
            type="number"
            id="focusDuration"
            value={focusMin}
            onChange={(e) => setFocusMin(Number(e.target.value))}
            min="1"
          />
        </div>

        <div className="settings-field">
          <label htmlFor="breakDuration">Pausa curta (minutos)</label>
          <input
            type="number"
            id="breakDuration"
            value={breakMin}
            onChange={(e) => setBreakMin(Number(e.target.value))}
            min="1"
          />
        </div>

        <div className="settings-field">
          <label htmlFor="longBreakDuration">Pausa longa (minutos)</label>
          <input
            type="number"
            id="longBreakDuration"
            value={longBreakMin}
            onChange={(e) => setLongBreakMin(Number(e.target.value))}
            min="1"
          />
        </div>

        <div className="settings-field">
          <label htmlFor="longBreakInterval">Pausa longa a cada N focos</label>
          <input
            type="number"
            id="longBreakInterval"
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            min="1"
          />
        </div>

        <div className="settings-toggle">
          <div>
            <p className="toggle-title">Som ao iniciar</p>
            <p className="toggle-sub">Beep curto ao iniciar o timer</p>
          </div>
          <button
            role="switch"
            aria-checked={startSound}
            className={`toggle ${startSound ? 'on' : ''}`}
            onClick={() => setStartSound(!startSound)}
          >
            <span className="knob" />
          </button>
        </div>

        <div className="settings-toggle">
          <div>
            <p className="toggle-title">Alarme ao finalizar</p>
            <p className="toggle-sub">Toca um alarme ao fim da sessão</p>
          </div>
          <button
            role="switch"
            aria-checked={alarmSound}
            className={`toggle ${alarmSound ? 'on' : ''}`}
            onClick={() => setAlarmSound(!alarmSound)}
          >
            <span className="knob" />
          </button>
        </div>

        <button className="settings-save" onClick={handleSave}>
          Salvar
        </button>
      </div>
    </div>
  );
}
