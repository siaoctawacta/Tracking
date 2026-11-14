/**
 * Notification chime generated with the Web Audio API (no audio file to download).
 * Browsers only allow sound after a user interaction: `armAudio()` unlocks it on the first click/key.
 */
let ctx: AudioContext | null = null

function context() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  return ctx
}

export function armAudio() {
  const unlock = () => { context(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
}

/** "info": soft two-note chime · "alert": brighter three-note chime (arrivals, new accounts). */
export function playChime(kind: 'info' | 'alert' = 'info') {
  const c = context()
  if (!c) return
  const notes = kind === 'alert' ? [784, 1047, 1319] : [659, 988]
  const start = c.currentTime + 0.02
  notes.forEach((freq, i) => {
    const t = start + i * 0.14
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.5)
  })
}

export const isAudioReady = () => ctx?.state === 'running'
