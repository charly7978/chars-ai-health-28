import { KalmanFilter } from "./KalmanFilter";
import { SavitzkyGolayFilter } from "./SavitzkyGolayFilter";
import { BiophysicalValidator } from "./BiophysicalValidator";
import { SignalQuality } from "./types";

export class PPGProcessor {
  private kalmanFilter: KalmanFilter;
  private sgFilter: SavitzkyGolayFilter;
  private validator: BiophysicalValidator;
  private readonly samplingRate = 30; // fps
  private readonly windowSize = 128; // ~4 segundos de datos
  private signalBuffer: number[] = [];

  constructor() {
    this.kalmanFilter = new KalmanFilter();
    this.sgFilter = new SavitzkyGolayFilter();
    this.validator = new BiophysicalValidator();
  }

  public processFrame(frame: ImageData): {
    signal: number[];
    quality: SignalQuality;
    peaks: number[];
  } {
    const ppgValue = this.extractPPGFromFrame(frame);
    this.signalBuffer.push(ppgValue);
    if (this.signalBuffer.length > this.windowSize) {
      this.signalBuffer.shift();
    }
    const filteredSignal = this.filterSignal(this.signalBuffer);
    const peaks = this.detectPeaks(filteredSignal);
    const quality = this.assessSignalQuality(filteredSignal, peaks);

    return {
      signal: filteredSignal,
      quality,
      peaks
    };
  }

  private extractPPGFromFrame(frame: ImageData): number {
    const { data } = frame;
    let greenSum = 0;
    let redSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      redSum += data[i];
      greenSum += data[i + 1];
    }
    return (greenSum - 0.7 * redSum) / (data.length / 4);
  }

  private filterSignal(signal: number[]): number[] {
    const kalmanFiltered = signal.map(val => this.kalmanFilter.filter(val));
    return this.sgFilter.filter(kalmanFiltered);
  }

  private detectPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const threshold = this.calculateAdaptiveThreshold(signal);
    for (let i = 1; i < signal.length - 1; i++) {
      if (
        signal[i] > threshold &&
        signal[i] > signal[i - 1] &&
        signal[i] > signal[i + 1]
      ) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private calculateAdaptiveThreshold(signal: number[]): number {
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const std = Math.sqrt(
      signal.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / signal.length
    );
    return mean + std;
  }

  private assessSignalQuality(signal: number[], peaks: number[]): SignalQuality {
    return this.validator.validateSignal(signal, peaks, this.samplingRate);
  }
}
}
