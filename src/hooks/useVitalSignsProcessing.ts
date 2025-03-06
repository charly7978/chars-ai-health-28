
import { useEffect } from 'react';
import { useHeartBeatProcessor } from './useHeartBeatProcessor';

export const useVitalSignsProcessing = ({
  lastSignal,
  isMonitoring,
  processVitalSigns,
  onVitalSignsUpdate,
  onSignalQualityUpdate
}) => {
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();

  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      
      if (vitals) {
        onVitalSignsUpdate(heartBeatResult.bpm, vitals);
        
        if (vitals.lastArrhythmiaData) {
          const [status, count] = vitals.arrhythmiaStatus.split('|');
        }
      }
      
      onSignalQualityUpdate(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, onVitalSignsUpdate, onSignalQualityUpdate]);
};
