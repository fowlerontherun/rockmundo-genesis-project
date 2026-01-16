/**
 * Audio utilities for voice chat
 * Provides audio level monitoring and speaking detection
 */

export class AudioLevelMonitor {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode;

  constructor(stream: MediaStream) {
    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.3;
    this.source.connect(this.analyser);
  }

  /**
   * Get current audio level (0-1)
   */
  getLevel(): number {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
  }

  /**
   * Check if audio level exceeds speaking threshold
   */
  isSpeaking(threshold = 0.05): boolean {
    return this.getLevel() > threshold;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.source.disconnect();
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

/**
 * Create audio element for remote stream playback
 */
export const createAudioElement = (stream: MediaStream): HTMLAudioElement => {
  const audio = document.createElement('audio');
  audio.srcObject = stream;
  audio.autoplay = true;
  audio.volume = 1.0;
  return audio;
};

/**
 * Request microphone access
 */
export const requestMicrophoneAccess = async (): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    return stream;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone permission denied. Please allow microphone access to use voice chat.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone to use voice chat.');
      }
    }
    throw new Error('Failed to access microphone. Please check your browser settings.');
  }
};

/**
 * Stop all tracks in a media stream
 */
export const stopMediaStream = (stream: MediaStream | null): void => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};
