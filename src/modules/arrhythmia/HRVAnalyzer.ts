export interface HRVMetrics {
  rmssd: number;
  sdnn: number;
  pnn50: number;
  lfhfRatio: number;
  entropy: number;
}

export class HRVAnalyzer {
  private static readonly RR_WINDOW_SIZE = 100;
  private static readonly RMSSD_THRESHOLD = 45;
  private static readonly PNN50_THRESHOLD = 0.1;
  private static readonly SDNN_THRESHOLD = 100;
  
  private rrIntervals: number[] = [];

  constructor() {
    this.reset();
  }

  addRRInterval(interval: number): void {
    this.rrIntervals.push(interval);
    if (this.rrIntervals.length > HRVAnalyzer.RR_WINDOW_SIZE) {
      this.rrIntervals.shift();
    }
  }

  analyze(): HRVMetrics {
    if (this.rrIntervals.length < HRVAnalyzer.RR_WINDOW_SIZE) {
      return {
        rmssd: 0,
        sdnn: 0,
        pnn50: 0,
        lfhfRatio: 1,
        entropy: 0
      };
    }

    const recentRR = this.rrIntervals.slice(-HRVAnalyzer.RR_WINDOW_SIZE);
    
    return {
      rmssd: this.calculateRMSSD(recentRR),
      sdnn: this.calculateSDNN(recentRR),
      pnn50: this.calculatePNN50(recentRR),
      lfhfRatio: this.calculateLFHF(recentRR),
      entropy: this.calculateSampleEntropy(recentRR)
    };
  }

  private calculateRMSSD(intervals: number[]): number {
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  }

  private calculateSDNN(intervals: number[]): number {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / intervals.length;
    return Math.sqrt(variance);
  }

  private calculatePNN50(intervals: number[]): number {
    const threshold = 50;
    let count = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (Math.abs(intervals[i] - intervals[i-1]) > threshold) {
        count++;
      }
    }
    return count / intervals.length;
  }

  private calculateLFHF(intervals: number[]): number {
    // Implementación simplificada de LF/HF ratio usando FFT
    const fftResult = this.applyFFT(intervals);
    const lf = this.calculateBandPower(fftResult, 0.04, 0.15);
    const hf = this.calculateBandPower(fftResult, 0.15, 0.4);
    return hf > 0 ? lf / hf : 1;
  }

  private applyFFT(data: number[]): number[] {
    // Implementación simplificada de FFT
    const N = data.length;
    const fft = new Array(N);
    
    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        sum += data[n] * Math.cos(angle);
      }
      fft[k] = sum;
    }
    
    return fft;
  }

  private calculateBandPower(fft: number[], lowFreq: number, highFreq: number): number {
    const N = fft.length;
    const fs = 1000; // Frecuencia de muestreo
    let power = 0;
    
    for (let i = 0; i < N; i++) {
      const freq = (i * fs) / N;
      if (freq >= lowFreq && freq <= highFreq) {
        power += Math.pow(fft[i], 2);
      }
    }
    
    return power;
  }

  private calculateSampleEntropy(data: number[]): number {
    const m = 2;
    const r = 0.2 * this.calculateSD(data);
    let A = 0, B = 0;

    for (let i = 0; i < data.length - m; i++) {
      for (let j = i + 1; j < data.length - m; j++) {
        if (this.isMatch(data, i, j, m, r)) {
          B++;
          if (this.isMatch(data, i, j, m + 1, r)) {
            A++;
          }
        }
      }
    }

    return Math.log(B / A);
  }

  private isMatch(data: number[], i: number, j: number, m: number, r: number): boolean {
    for (let k = 0; k < m; k++) {
      if (Math.abs(data[i + k] - data[j + k]) > r) {
        return false;
      }
    }
    return true;
  }

  reset(): void {
    this.rrIntervals = [];
    console.log("HRVAnalyzer: Reset completo");
  }
}
