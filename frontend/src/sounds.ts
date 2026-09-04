let audioCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(ctx: AudioContext, frequency: number, startAt: number, duration: number, volume = 0.2, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

export function playStartSound() {
  const ctx = getContext();
  const now = ctx.currentTime;
  playTone(ctx, 660, now, 0.15, 0.15);
  playTone(ctx, 880, now + 0.16, 0.2, 0.15);
}

export function playAlarmSound() {
  const ctx = getContext();
  const now = ctx.currentTime;
  for (let round = 0; round < 2; round++) {
    const base = now + round * 0.9;
    for (let i = 0; i < 3; i++) {
      playTone(ctx, 880, base + i * 0.22, 0.15, 0.25, 'square');
      playTone(ctx, 1760, base + i * 0.22, 0.15, 0.08, 'sine');
    }
  }
}
