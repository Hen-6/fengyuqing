export class SenseVoiceRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private isRecording: boolean = false;
  private onTranscript: (text: string) => void;
  private threshold: number = 0.008; // volume threshold (0 to 1)
  private silenceDuration: number = 1000; // ms of silence to segment the audio

  constructor(onTranscript: (text: string) => void) {
    this.onTranscript = onTranscript;
  }

  async start() {
    if (this.isRecording) return;
    this.isRecording = true;
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length === 0) return;
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        
        // Send to ASR endpoint
        const formData = new FormData();
        formData.append('file', audioBlob, 'speech.webm');
        
        try {
          const res = await fetch('http://localhost:8000/api/asr', {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text && data.text.trim()) {
              this.onTranscript(data.text.trim());
            }
          }
        } catch (err) {
          console.error('[SenseVoice] Failed to transcribe:', err);
        }

        // Automatically start recording the next chunk
        if (this.isRecording) {
          this.restart();
        }
      };

      this.mediaRecorder.start();
      this.monitorSilence();
    } catch (err) {
      console.error('[SenseVoice] Failed to start recorder:', err);
      this.isRecording = false;
    }
  }

  private monitorSilence() {
    if (!this.isRecording || !this.analyser) return;

    const bufferLength = this.analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    
    const check = () => {
      if (!this.isRecording || !this.analyser) return;
      
      this.analyser.getFloatTimeDomainData(dataArray);
      
      // Calculate Root Mean Square (RMS) volume
      let sumSquares = 0.0;
      for (const amplitude of dataArray) {
        sumSquares += amplitude * amplitude;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      
      if (rms < this.threshold) {
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
              this.mediaRecorder.stop();
            }
          }, this.silenceDuration);
        }
      } else {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      }
      
      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  }

  private restart() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive' && this.isRecording) {
      this.audioChunks = [];
      this.mediaRecorder.start();
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    }
  }

  stop() {
    this.isRecording = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
}
