// Advanced Web Audio API synthesizer for Go stone placement clicks and flowing water BGM.

let audioCtx: AudioContext | null = null;
let streamSources: AudioBufferSourceNode[] = [];
let streamGains: GainNode[] = [];
let streamFilters: BiquadFilterNode[] = [];
let lfos: OscillatorNode[] = [];
let lfoGains: GainNode[] = [];
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
 * Synthesizes an extremely crisp and realistic Go stone placement sound.
 * Combines high-frequency contact clicks, slate/shell transient friction noise, 
 * and Kaya wood board cabinet resonances.
 */
export function playStoneSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 1. High-frequency sharp attack click (the slate/glass contact snap)
    const attackOsc = ctx.createOscillator();
    const attackGain = ctx.createGain();
    attackOsc.type = 'sine';
    // Very fast pitch sweep from 5000Hz down to 900Hz in 10ms for maximum crispness
    attackOsc.frequency.setValueAtTime(5000, now);
    attackOsc.frequency.exponentialRampToValueAtTime(900, now + 0.01);
    
    attackGain.gain.setValueAtTime(0.45, now);
    attackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    
    attackOsc.connect(attackGain);
    attackGain.connect(ctx.destination);
    attackOsc.start(now);
    attackOsc.stop(now + 0.012);

    // 2. Ultra-short highpass noise burst (slate/shell friction click)
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
    noiseFilter.frequency.setValueAtTime(3500, now); // Keep only crisp high frequencies
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.006);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.008);

    // 3. Resonant wood board body (the Kaya wood thump)
    const boardOsc = ctx.createOscillator();
    const boardGain = ctx.createGain();
    boardOsc.type = 'triangle';
    boardOsc.frequency.setValueAtTime(420, now); // slightly higher frequency for definition
    boardOsc.frequency.exponentialRampToValueAtTime(210, now + 0.05);

    boardGain.gain.setValueAtTime(0.32, now);
    boardGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    boardOsc.connect(boardGain);
    boardGain.connect(ctx.destination);
    boardOsc.start(now);
    boardOsc.stop(now + 0.06);

    // 4. Low-frequency cabinet cavity resonance (depth/thud)
    const cavityOsc = ctx.createOscillator();
    const cavityGain = ctx.createGain();
    cavityOsc.type = 'sine';
    cavityOsc.frequency.setValueAtTime(95, now);
    cavityGain.gain.setValueAtTime(0.12, now);
    cavityGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    cavityOsc.connect(cavityGain);
    cavityGain.connect(ctx.destination);
    cavityOsc.start(now);
    cavityOsc.stop(now + 0.11);
  } catch (e) {
    console.warn('Failed to play stone sound:', e);
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

    gain.gain.setValueAtTime(isLowDrop ? 0.009 : 0.005, now);
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
  } catch (e) {
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

    // Configure 3 independent audio bands for rich water layers
    const bandsConfig = [
      { centerFreq: 320, type: 'lowpass' as const, Q: 1.0, gain: 0.038, lfoRate: 0.04, lfoDepth: 80, name: 'deep current' },
      { centerFreq: 750, type: 'bandpass' as const, Q: 2.0, gain: 0.015, lfoRate: 0.12, lfoDepth: 160, name: 'mid splashes' },
      { centerFreq: 2200, type: 'bandpass' as const, Q: 3.0, gain: 0.008, lfoRate: 0.28, lfoDepth: 400, name: 'high babble' }
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

    // Schedule droplet triggers at irregular natural intervals
    bubbleTimerId = setInterval(() => {
      if (isBgmPlaying && Math.random() > 0.2) {
        playWaterBubble();
      }
    }, 110);

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
      } catch (e) {}
    }
  });

  lfos.forEach(node => {
    if (node) {
      try {
        node.stop();
      } catch (e) {}
    }
  });

  streamSources = [];
  streamFilters = [];
  streamGains = [];
  lfos = [];
  lfoGains = [];
}
