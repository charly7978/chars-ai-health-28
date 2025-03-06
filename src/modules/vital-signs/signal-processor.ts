
export class SignalProcessor {
  private readonly SMA_WINDOW = 3;
  private ppgValues: number[] = [];
  private readonly WINDOW_SIZE = 300;

  /**
   * Applies a Simple Moving Average filter to the signal
   */
  public applySMAFilter(value: number): number {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    const smaBuffer = this.ppgValues.slice(-this.SMA_WINDOW);
    smaBuffer.push(value);
    return smaBuffer.reduce((a, b) => a + b, 0) / smaBuffer.length;
  }

  /**
   * Reset the signal processor state
   */
  public reset(): void {
    this.ppgValues = [];
  }

  /**
   * Get the current PPG values buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
}
