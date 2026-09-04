import { useEffect, useRef, useState } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { StartTimer, StopTimer, GetSettings, SaveSettings } from '../wailsjs/go/main/App';
import { playStartSound, playAlarmSound } from './sounds';

export type PomodoroMode = 'focus' | 'short' | 'long';

export function usePomodoro() {
  const [focusDuration, setFocusDuration] = useState(1500);
  const [breakDuration, setBreakDuration] = useState(300);
  const [longBreakDuration, setLongBreakDuration] = useState(900);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [startSoundEnabled, setStartSoundEnabled] = useState(true);
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(1500);
  const [isActive, setIsActive] = useState(false);
  const [currentMode, setCurrentMode] = useState<PomodoroMode>('focus');

  const durationsRef = useRef({ focus: 1500, short: 300, long: 900 });
  const modeRef = useRef<PomodoroMode>('focus');
  const activeRef = useRef(false);
  const startSoundRef = useRef(true);
  const alarmSoundRef = useRef(true);
  const longBreakIntervalRef = useRef(4);
  const focusCountRef = useRef(parseInt(localStorage.getItem('pomoFocusCount') || '0', 10));

  useEffect(() => {
    longBreakIntervalRef.current = longBreakInterval;
  }, [longBreakInterval]);

  useEffect(() => {
    durationsRef.current = { focus: focusDuration, short: breakDuration, long: longBreakDuration };
  }, [focusDuration, breakDuration, longBreakDuration]);

  useEffect(() => {
    modeRef.current = currentMode;
  }, [currentMode]);

  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    startSoundRef.current = startSoundEnabled;
    alarmSoundRef.current = alarmSoundEnabled;
  }, [startSoundEnabled, alarmSoundEnabled]);

  useEffect(() => {
    GetSettings().then((settings) => {
      setFocusDuration(settings.focusDuration);
      setBreakDuration(settings.breakDuration);
      setLongBreakDuration(settings.longBreakDuration);
      setLongBreakInterval(settings.longBreakInterval);
      setStartSoundEnabled(settings.startSoundEnabled);
      setAlarmSoundEnabled(settings.alarmSoundEnabled);
      startSoundRef.current = settings.startSoundEnabled;
      alarmSoundRef.current = settings.alarmSoundEnabled;
      longBreakIntervalRef.current = settings.longBreakInterval;
      durationsRef.current = {
        focus: settings.focusDuration,
        short: settings.breakDuration,
        long: settings.longBreakDuration,
      };
      setTimeLeft(durationsRef.current[modeRef.current]);
    });

    const offTick = EventsOn('timer_tick', (remaining: number) => {
      setTimeLeft(remaining);
    });

    const offFinished = EventsOn('timer_finished', (completedType: 'focus' | 'break') => {
      setIsActive(false);
      if (alarmSoundRef.current) {
        playAlarmSound();
      }

      if (completedType === 'focus') {
        const count = focusCountRef.current + 1;
        focusCountRef.current = count;
        localStorage.setItem('pomoFocusCount', String(count));

        const interval = longBreakIntervalRef.current;
        const nextMode: PomodoroMode = count % interval === 0 ? 'long' : 'short';
        setCurrentMode(nextMode);
        modeRef.current = nextMode;
        setTimeLeft(durationsRef.current[nextMode]);
      } else {
        setCurrentMode('focus');
        modeRef.current = 'focus';
        setTimeLeft(durationsRef.current['focus']);
      }

      new Notification(completedType === 'focus' ? 'Hora de descansar!' : 'De volta ao trabalho!', {
        body: completedType === 'focus' ? 'Parabéns pelo bloco de foco concluído.' : 'Pronto para focar?',
      });
    });

    return () => {
      offTick();
      offFinished();
    };
  }, []);

  const updateSettings = async (
    newFocus: number,
    newBreak: number,
    newLongBreak: number,
    newLongBreakInterval: number,
    newStartSound: boolean,
    newAlarmSound: boolean
  ) => {
    await SaveSettings(newFocus, newBreak, newLongBreak, newLongBreakInterval, newStartSound, newAlarmSound);
    setFocusDuration(newFocus);
    setBreakDuration(newBreak);
    setLongBreakDuration(newLongBreak);
    setLongBreakInterval(newLongBreakInterval);
    setStartSoundEnabled(newStartSound);
    setAlarmSoundEnabled(newAlarmSound);
    durationsRef.current = { focus: newFocus, short: newBreak, long: newLongBreak };
    longBreakIntervalRef.current = newLongBreakInterval;
    startSoundRef.current = newStartSound;
    alarmSoundRef.current = newAlarmSound;
    if (!activeRef.current) {
      setTimeLeft(durationsRef.current[modeRef.current]);
    }
  };

  const startTimer = (mode: PomodoroMode) => {
    if (startSoundRef.current) {
      playStartSound();
    }
    setIsActive(true);
    setCurrentMode(mode);
    modeRef.current = mode;
    const duration = durationsRef.current[mode];
    setTimeLeft(duration);
    StartTimer(duration, mode === 'focus' ? 'focus' : 'break');
  };

  const stopTimer = () => {
    setIsActive(false);
    StopTimer();
  };

  const resetTimer = () => {
    stopTimer();
    setTimeLeft(durationsRef.current[modeRef.current]);
  };

  const selectMode = (mode: PomodoroMode) => {
    stopTimer();
    setCurrentMode(mode);
    modeRef.current = mode;
    setTimeLeft(durationsRef.current[mode]);
  };

  const totalDuration = durationsRef.current[currentMode];

  return {
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
  };
}
