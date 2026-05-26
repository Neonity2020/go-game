// Web Audio API synthesizer for Go stone placement click sounds and flowing water BGM.

let audioCtx: AudioContext | null = null;
let streamSource: AudioBufferSourceNode | null = null;
let streamGain: GainNode | null = null;
let streamFilter: BiquadFilterNode | null = null;
let streamFilter2: BiquadFilterNode | null = null;
let lfo1: OscillatorNode | null = null;
let lfo1Gain: GainNode | null = null;
let lfo2: OscillatorNode | null = null;
let lfo2Gain: GainNode | null = null;
let bubbleTimerId: any = null;
let isBgmPlaying = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Synthesizes a realistic Go stone placement sound (clack and wood resonance)
 */
export function playStoneSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 1. Attack snap (very short high-frequency triangle/noise click)
    const attackOsc = ctx.createOscillator();
    const attackGain = ctx.createGain();
    attackOsc.type = 'triangle';
    attackOsc.frequency.setValueAtTime(1600, now);
    attackOsc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
    
    attackGain.gain.setValueAtTime(0.28, now);
    attackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    attackOsc.connect(attackGain);
    attackGain.connect(ctx.destination);
    attackOsc.start(now);
    attackOsc.stop(now + 0.045);

    // 2. Kaya Go board wood resonance (lower mid thud)
    const boardOsc = ctx.createOscillator();
    const boardGain = ctx.createGain();
    boardOsc.type = 'sine';
    boardOsc.frequency.setValueAtTime(290, now);
    boardOsc.frequency.exponentialRampToValueAtTime(170, now + 0.08);

    boardGain.gain.setValueAtTime(0.55, now);
    boardGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    boardOsc.connect(boardGain);
    boardGain.connect(ctx.destination);
    boardOsc.start(now);
    boardOsc.stop(now + 0.11);

    // 3. Deeper cabinet hollow resonance (low frequency base)
    const cabinetOsc = ctx.createOscillator();
    const cabinetGain = ctx.createGain();
    cabinetOsc.type = 'sine';
    cabinetOsc.frequency.setValueAtTime(85, now);
    
    cabinetGain.gain.setValueAtTime(0.12, now);
    cabinetGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    cabinetOsc.connect(cabinetGain);
    cabinetGain.connect(ctx.destination);
    cabinetOsc.start(now);
    cabinetOsc.stop(now + 0.19);
  } catch (e) {
    console.warn('Failed to play stone sound:', e);
  }
}

/**
 * Triggers a tiny high-pitched droplet bubble sound for the flowing water BGM
 */
function playWaterBubble() {
  if (!audioCtx || !isBgmPlaying) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    // Random high frequency representing tiny bubbles rising
    const startFreq = 950 + Math.random() * 1100;
    const endFreq = startFreq + 150 + Math.random() * 250;
    
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.07);

    // Dynamic low volume to sound distant and organic
    gain.gain.setValueAtTime(0.003 + Math.random() * 0.008, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {
    // Ignore minor Web Audio scheduling issues
  }
}

/**
 * Starts generating a procedural ambient soundscape of flowing water
 */
export function startBgm() {
  if (isBgmPlaying) return;
  try {
    const ctx = getAudioContext();
    isBgmPlaying = true;
    const now = ctx.currentTime;

    // 1. Create a 2-second white noise buffer
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    streamSource = ctx.createBufferSource();
    streamSource.buffer = noiseBuffer;
    streamSource.loop = true;

    // 2. Configure filters to shape noise into rushing water
    streamFilter = ctx.createBiquadFilter();
    streamFilter.type = 'bandpass';
    streamFilter.Q.value = 1.0;
    streamFilter.frequency.setValueAtTime(450, now);

    streamFilter2 = ctx.createBiquadFilter();
    streamFilter2.type = 'lowpass';
    streamFilter2.frequency.setValueAtTime(700, now);

    streamGain = ctx.createGain();
    streamGain.gain.setValueAtTime(0.06, now); // Quiet background volume

    // Connect nodes
    streamSource.connect(streamFilter);
    streamFilter.connect(streamFilter2);
    streamFilter2.connect(streamGain);
    streamGain.connect(ctx.destination);

    streamSource.start(now);

    // 3. Modulate filter frequency with slow LFO (water current variation)
    lfo1 = ctx.createOscillator();
    lfo1.frequency.setValueAtTime(0.12, now);
    lfo1Gain = ctx.createGain();
    lfo1Gain.gain.setValueAtTime(120, now);
    
    lfo1.connect(lfo1Gain);
    lfo1Gain.connect(streamFilter.frequency);
    lfo1.start(now);

    // 4. Modulate gain/volume slightly with a second slow LFO (water waves)
    lfo2 = ctx.createOscillator();
    lfo2.frequency.setValueAtTime(0.08, now);
    lfo2Gain = ctx.createGain();
    lfo2Gain.gain.setValueAtTime(0.018, now);

    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(streamGain.gain);
    lfo2.start(now);

    // 5. Schedule periodic high-frequency bubble sounds
    bubbleTimerId = setInterval(() => {
      if (isBgmPlaying && Math.random() > 0.3) {
        playWaterBubble();
      }
    }, 150);

  } catch (e) {
    console.error('Failed to start water BGM:', e);
    isBgmPlaying = false;
  }
}

/**
 * Stops the flowing water BGM and cleans up Web Audio nodes
 */
export function stopBgm() {
  if (!isBgmPlaying) return;
  isBgmPlaying = false;

  if (bubbleTimerId) {
    clearInterval(bubbleTimerId);
    bubbleTimerId = null;
  }

  const nodes = [streamSource, lfo1, lfo2];
  nodes.forEach(node => {
    if (node) {
      try {
        node.stop();
      } catch (e) {}
    }
  });

  streamSource = null;
  streamGain = null;
  streamFilter = null;
  streamFilter2 = null;
  lfo1 = null;
  lfo1Gain = null;
  lfo2 = null;
  lfo2Gain = null;
}
