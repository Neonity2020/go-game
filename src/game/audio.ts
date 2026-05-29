// Advanced Web Audio API synthesizer for Go stone placement clicks and flowing water BGM.

let audioCtx: AudioContext | null = null;
let streamSources: AudioBufferSourceNode[] = [];
let streamGains: GainNode[] = [];
let streamFilters: BiquadFilterNode[] = [];
let lfos: OscillatorNode[] = [];
let lfoGains: GainNode[] = [];
let bubbleTimerId: number | null = null;
let isBgmPlaying = false;

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextConstructor = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error('Web Audio API is not supported');
    }
    audioCtx = new AudioContextConstructor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Synthesizes an extremely crisp and realistic Go stone placement sound.
 * Combines high-frequency contact clicks, slate/shell transient friction noise, 
 * and Kaya wood board cabinet resonances.
 */
export function playStoneSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Delay between the first pre-click and the second main click (16ms)
    // This double impact creates the realistic "pa-pa" (啪) signature sound of Go stones.
    const mainDelay = 0.016; 

    // ==========================================
    // STRIKE 1: Pre-click (Initial touch / finger snap slip)
    // ==========================================
    const click1Osc = ctx.createOscillator();
    const click1Gain = ctx.createGain();
    click1Osc.type = 'sine';
    // Very high pitch sweep for a tiny crisp contact click
    click1Osc.frequency.setValueAtTime(5800, now);
    click1Osc.frequency.exponentialRampToValueAtTime(1200, now + 0.007);
    
    click1Gain.gain.setValueAtTime(0.18, now);
    click1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.007);
    
    click1Osc.connect(click1Gain);
    click1Gain.connect(ctx.destination);
    click1Osc.start(now);
    click1Osc.stop(now + 0.008);

    // ==========================================
    // STRIKE 2: Main click & resonance (delayed by 16ms)
    // ==========================================
    const t2 = now + mainDelay;

    // A. Main crisp contact clack
    const click2Osc = ctx.createOscillator();
    const click2Gain = ctx.createGain();
    click2Osc.type = 'sine';
    click2Osc.frequency.setValueAtTime(4600, t2);
    click2Osc.frequency.exponentialRampToValueAtTime(800, t2 + 0.011);
    
    click2Gain.gain.setValueAtTime(0.48, t2);
    click2Gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.011);
    
    click2Osc.connect(click2Gain);
    click2Gain.connect(ctx.destination);
    click2Osc.start(t2);
    click2Osc.stop(t2 + 0.013);

    // B. Main transient high-pass noise burst for organic texture
    const bufferSize = ctx.sampleRate * 0.008; // 8ms of noise
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(3200, t2);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.24, t2);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.007);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(t2);
    noiseSource.stop(t2 + 0.008);

    // C. Wooden board resonance (Kaya wood thud)
    const boardOsc = ctx.createOscillator();
    const boardGain = ctx.createGain();
    boardOsc.type = 'triangle';
    boardOsc.frequency.setValueAtTime(390, t2);
    boardOsc.frequency.exponentialRampToValueAtTime(180, t2 + 0.05);

    boardGain.gain.setValueAtTime(0.3, t2);
    boardGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.05);

    boardOsc.connect(boardGain);
    boardGain.connect(ctx.destination);
    boardOsc.start(t2);
    boardOsc.stop(t2 + 0.06);

    // D. Low cabinet cavity thump
    const cavityOsc = ctx.createOscillator();
    const cavityGain = ctx.createGain();
    cavityOsc.type = 'sine';
    cavityOsc.frequency.setValueAtTime(90, t2);
    cavityGain.gain.setValueAtTime(0.1, t2);
    cavityGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.1);

    cavityOsc.connect(cavityGain);
    cavityGain.connect(ctx.destination);
    cavityOsc.start(t2);
    cavityOsc.stop(t2 + 0.11);
  } catch (e) {
    console.warn('Failed to play stone sound:', e);
  }
}

/**
 * Synthesizes a stone capture sound — a crisp "tok" of stones being plucked off the board,
 * followed by a gentle clatter as they settle into the lid.
 */
export function playCaptureSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // A. Quick upward pluck — stone lifted off the board
    const pluckOsc = ctx.createOscillator();
    const pluckGain = ctx.createGain();
    pluckOsc.type = 'triangle';
    pluckOsc.frequency.setValueAtTime(800, now);
    pluckOsc.frequency.exponentialRampToValueAtTime(2200, now + 0.015);

    pluckGain.gain.setValueAtTime(0.22, now);
    pluckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    pluckOsc.connect(pluckGain);
    pluckGain.connect(ctx.destination);
    pluckOsc.start(now);
    pluckOsc.stop(now + 0.02);

    // B. Stone-on-stone clatter — short midrange noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.04);
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, now + 0.02);
    bp.Q.setValueAtTime(2.0, now + 0.02);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0, now);
    nGain.gain.linearRampToValueAtTime(0.2, now + 0.022);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noiseSrc.connect(bp);
    bp.connect(nGain);
    nGain.connect(ctx.destination);
    noiseSrc.start(now + 0.02);
    noiseSrc.stop(now + 0.07);

    // C. Settling "tok" — stones resting in the lid (wood-on-wood)
    const tokOsc = ctx.createOscillator();
    const tokGain = ctx.createGain();
    tokOsc.type = 'sine';
    tokOsc.frequency.setValueAtTime(420, now + 0.045);
    tokOsc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

    tokGain.gain.setValueAtTime(0.0, now);
    tokGain.gain.linearRampToValueAtTime(0.16, now + 0.048);
    tokGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    tokOsc.connect(tokGain);
    tokGain.connect(ctx.destination);
    tokOsc.start(now + 0.045);
    tokOsc.stop(now + 0.13);
  } catch (e) {
    console.warn('Failed to play capture sound:', e);
  }
}

/**
 * Triggers a highly realistic liquid droplet/bubble sound.
 * Real droplets plop from lower to higher frequencies with high filter resonance.
 */
function playWaterBubble() {
  if (!audioCtx || !isBgmPlaying) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    
    // Distinguish low "bloop" drops from high "tink" droplets for realism
    const isLowDrop = Math.random() > 0.4;
    const startFreq = isLowDrop 
      ? 350 + Math.random() * 200 
      : 1200 + Math.random() * 600;
    // Rapid upward frequency rise characteristic of liquid bubbles popping
    const endFreq = startFreq * (1.3 + Math.random() * 0.25);
    
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.055);

    gain.gain.setValueAtTime(isLowDrop ? 0.014 : 0.008, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    // Resonant bandpass filter creates the "liquid" ringing hollow quality
    const dropFilter = audioCtx.createBiquadFilter();
    dropFilter.type = 'bandpass';
    dropFilter.frequency.setValueAtTime(endFreq, now);
    dropFilter.Q.setValueAtTime(6.0, now); // High Q for resonant "bloop"

    osc.connect(dropFilter);
    dropFilter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    // Ignore minor scheduling errors
  }
}

/**
 * Starts generating a highly realistic multi-band procedural flowing water stream soundscape.
 * Combines 3 independent frequency noise bands and liquid droplets.
 */
export function startBgm() {
  if (isBgmPlaying) return;
  try {
    const ctx = getAudioContext();
    isBgmPlaying = true;
    const now = ctx.currentTime;

    // Create a 2-second white noise buffer used across all bands
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    // Configure 4 independent audio bands — emphasizing water over wind:
    // - Low/mid bands louder for deep current and splashes
    // - High band toned down to reduce airy/windy quality
    // - Added a dedicated gurgle band for liquid texture
    const bandsConfig = [
      { centerFreq: 280, type: 'lowpass' as const, Q: 0.8, gain: 0.05, lfoRate: 0.035, lfoDepth: 70, name: 'deep current' },
      { centerFreq: 550, type: 'bandpass' as const, Q: 1.8, gain: 0.03, lfoRate: 0.08, lfoDepth: 120, name: 'gurgle' },
      { centerFreq: 900, type: 'bandpass' as const, Q: 2.0, gain: 0.02, lfoRate: 0.1, lfoDepth: 150, name: 'mid splashes' },
      { centerFreq: 1600, type: 'bandpass' as const, Q: 2.5, gain: 0.008, lfoRate: 0.2, lfoDepth: 250, name: 'high babble' }
    ];

    bandsConfig.forEach((band) => {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.setValueAtTime(band.centerFreq, now);
      filter.Q.setValueAtTime(band.Q, now);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(band.gain, now);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(now);

      // Modulate frequency of this band to create water wave current dynamics
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(band.lfoRate, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(band.lfoDepth, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(now);

      streamSources.push(source);
      streamFilters.push(filter);
      streamGains.push(gainNode);
      lfos.push(lfo);
      lfoGains.push(lfoGain);
    });

    // Schedule droplet triggers — more frequent for richer water texture
    bubbleTimerId = setInterval(() => {
      if (isBgmPlaying && Math.random() > 0.15) {
        playWaterBubble();
      }
    }, 85);

  } catch (e) {
    console.error('Failed to start realistic water BGM:', e);
    isBgmPlaying = false;
  }
}

/**
 * Stops BGM and cleans up Web Audio nodes
 */
export function stopBgm() {
  if (!isBgmPlaying) return;
  isBgmPlaying = false;

  if (bubbleTimerId) {
    clearInterval(bubbleTimerId);
    bubbleTimerId = null;
  }

  streamSources.forEach(node => {
    if (node) {
      try {
        node.stop();
      } catch {
        // Node may already be stopped.
      }
    }
  });

  lfos.forEach(node => {
    if (node) {
      try {
        node.stop();
      } catch {
        // LFO may already be stopped.
      }
    }
  });

  streamSources = [];
  streamFilters = [];
  streamGains = [];
  lfos = [];
  lfoGains = [];
}
