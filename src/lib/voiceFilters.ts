export type VoiceFilterType = 'normal' | 'chipmunk' | 'robot' | 'deep' | 'radio' | 'echo';

export interface VoiceFilterOption {
  id: VoiceFilterType;
  label: string;
  emoji: string;
  desc: string;
}

export const VOICE_FILTERS: VoiceFilterOption[] = [
  { id: 'normal', emoji: '🎙️', label: 'স্বাভাবিক', desc: 'আসল কণ্ঠস্বর' },
  { id: 'chipmunk', emoji: '🐿️', label: 'চিপমাঙ্ক', desc: 'মজার কার্টুন ও হাই পিচ' },
  { id: 'robot', emoji: '🤖', label: 'রোবট', desc: 'সাইবার রোবটিক ইফেক্ট' },
  { id: 'deep', emoji: '👾', label: 'ডিপ মনস্টার', desc: 'ভারী ও গভীর গম্ভীর কণ্ঠ' },
  { id: 'radio', emoji: '📻', label: 'ওয়াকি-টকি', desc: 'ট্যাকটিক্যাল গেম রেডিও' },
  { id: 'echo', emoji: '🌌', label: 'ইকো রিভার্ব', desc: 'গুহা ও রুমের প্রতিধ্বনি' },
];

/**
 * Universal PCM Audio Recorder using Web Audio API.
 * Captures raw samples directly in memory so duration is ALWAYS accurate and never 0:00.
 */
export class PcmVoiceRecorder {
  private audioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate: number = 16000;
  private isRecording: boolean = false;

  async start(): Promise<void> {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    this.sampleRate = this.audioCtx.sampleRate;

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    // Buffer size 4096 gives smooth audio capture without dropouts
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const input = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    this.isRecording = true;
  }

  stop(): { samples: Float32Array; sampleRate: number; duration: number } {
    this.isRecording = false;

    if (this.processor && this.source) {
      try {
        this.source.disconnect();
        this.processor.disconnect();
      } catch {}
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }

    let totalLength = 0;
    for (const c of this.chunks) {
      totalLength += c.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const c of this.chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    const duration = totalLength > 0 ? totalLength / this.sampleRate : 0;
    return { samples: merged, sampleRate: this.sampleRate, duration };
  }
}

/**
 * Resamples raw audio to a target sample rate (e.g. 16,000Hz).
 */
function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;
  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < samples.length; i++) {
      accum += samples[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Creates a standard 16-bit Mono WAV Data URL from PCM float samples.
 */
function encodeWavDataUrl(samples: Float32Array, sampleRate: number): string {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write 16-bit signed PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  // Convert buffer to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

/**
 * Applies the selected voice filter directly on raw PCM samples and returns a standard WAV Data URL.
 */
export function applyFilterToPcmSamples(
  inputSamples: Float32Array,
  originalSampleRate: number,
  filterType: VoiceFilterType
): { dataUrl: string; duration: number } {
  if (inputSamples.length === 0) {
    return { dataUrl: '', duration: 0 };
  }

  // Downsample to clean 16,000Hz mono
  const targetRate = 16000;
  const pcm16k = downsample(inputSamples, originalSampleRate, targetRate);
  let processed = pcm16k;

  if (filterType === 'chipmunk') {
    // Pitch shift UP (factor 1.45)
    const factor = 1.45;
    const newLen = Math.floor(pcm16k.length / factor);
    const pitched = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i * factor;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(pcm16k.length - 1, i0 + 1);
      const frac = srcIdx - i0;
      pitched[i] = pcm16k[i0] * (1 - frac) + pcm16k[i1] * frac;
    }
    processed = pitched;
  } else if (filterType === 'deep') {
    // Pitch shift DOWN (factor 0.72)
    const factor = 0.72;
    const newLen = Math.floor(pcm16k.length / factor);
    const pitched = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i * factor;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(pcm16k.length - 1, i0 + 1);
      const frac = srcIdx - i0;
      pitched[i] = pcm16k[i0] * (1 - frac) + pcm16k[i1] * frac;
    }
    processed = pitched;
  } else if (filterType === 'robot') {
    // Ring modulator carrier ~55Hz
    const robotic = new Float32Array(pcm16k.length);
    for (let i = 0; i < pcm16k.length; i++) {
      const carrier = 0.35 + 0.65 * Math.sin((2 * Math.PI * 55 * i) / targetRate);
      robotic[i] = pcm16k[i] * carrier * 1.2;
    }
    processed = robotic;
  } else if (filterType === 'radio') {
    // Walkie-talkie bandpass + saturation
    const radio = new Float32Array(pcm16k.length);
    let prev = 0;
    for (let i = 0; i < pcm16k.length; i++) {
      // Simple high-pass + overdrive
      const hp = pcm16k[i] - prev * 0.85;
      prev = pcm16k[i];
      // Soft saturation overdrive
      radio[i] = Math.tanh(hp * 2.2) * 0.8;
    }
    processed = radio;
  } else if (filterType === 'echo') {
    // Reverb echo delay
    const delaySamples = Math.floor(targetRate * 0.22); // 220ms delay
    const echo = new Float32Array(pcm16k.length + delaySamples * 2);
    echo.set(pcm16k);
    for (let i = 0; i < pcm16k.length; i++) {
      if (i + delaySamples < echo.length) {
        echo[i + delaySamples] += pcm16k[i] * 0.45;
      }
      if (i + delaySamples * 2 < echo.length) {
        echo[i + delaySamples * 2] += pcm16k[i] * 0.22;
      }
    }
    processed = echo;
  }

  const duration = processed.length / targetRate;
  const dataUrl = encodeWavDataUrl(processed, targetRate);
  return { dataUrl, duration };
}
