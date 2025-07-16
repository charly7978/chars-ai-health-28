import React, { useState, useEffect } from 'react';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';
import { FrameProcessingMonitor } from '../utils/FrameProcessingMonitor';
import { CallbackDiagnostics } from '../utils/CallbackDiagnostics';
import { SignalQualityValidator } from '../utils/SignalQualityValidator';

interface DiagnosticOverlayProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Overlay de diagnóstico para mostrar métricas en tiempo real
 * Solo visible en modo desarrollo
 */
const DiagnosticOverlay: React.FC<DiagnosticOverlayProps> = ({ isVisible, onToggle }) => {
  const [metrics, setMetrics] = useState<any>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'metrics' | 'logs' | 'callbacks'>('metrics');
  
  const logger = DiagnosticLogger.getInstance();
  
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      // Actualizar métricas cada segundo
      setMetrics({
        timestamp: new Date().toLocaleTimeString(),
        // Las métricas se actualizarán desde los componentes que usen el monitor
      });
      
      // Obtener logs recientes
      const recentLogs = logger.getEvents(undefined, undefined, 20);
      setLogs(recentLogs);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isVisible, logger]);
  
  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-3 py-1 rounded text-sm"
        style={{ zIndex: 9999 }}
      >
        📊 Diagnóstico
      </button>
    );
  }
  
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-end p-4">
      <div className="bg-white rounded-lg shadow-lg w-96 max-h-screen overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
          <h3 className="font-semibold">Diagnóstico del Sistema</h3>
          <button
            onClick={onToggle}
            className="text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 text-sm ${
              activeTab === 'metrics' 
                ? 'bg-blue-100 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Métricas
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-sm ${
              activeTab === 'logs' 
                ? 'bg-blue-100 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setActiveTab('callbacks')}
            className={`px-4 py-2 text-sm ${
              activeTab === 'callbacks' 
                ? 'bg-blue-100 text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Callbacks
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {activeTab === 'metrics' && (
            <MetricsTab metrics={metrics} />
          )}
          
          {activeTab === 'logs' && (
            <LogsTab logs={logs} />
          )}
          
          {activeTab === 'callbacks' && (
            <CallbacksTab />
          )}
        </div>
        
        {/* Actions */}
        <div className="border-t p-3 flex gap-2">
          <button
            onClick={() => logger.clear()}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Limpiar Logs
          </button>
          <button
            onClick={() => {
              const logs = logger.exportLogs();
              const blob = new Blob([logs], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `diagnostic-logs-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricsTab: React.FC<{ metrics: any }> = ({ metrics }) => (
  <div className="space-y-3">
    <div className="text-sm text-gray-600">
      Última actualización: {metrics.timestamp || 'N/A'}
    </div>
    
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="bg-gray-50 p-2 rounded">
        <div className="font-semibold text-gray-700">FPS</div>
        <div className="text-lg">{metrics.fps || '0'}</div>
      </div>
      
      <div className="bg-gray-50 p-2 rounded">
        <div className="font-semibold text-gray-700">Latencia</div>
        <div className="text-lg">{metrics.latency || '0'}ms</div>
      </div>
      
      <div className="bg-gray-50 p-2 rounded">
        <div className="font-semibold text-gray-700">Calidad</div>
        <div className="text-lg">{metrics.signalQuality || '0'}</div>
      </div>
      
      <div className="bg-gray-50 p-2 rounded">
        <div className="font-semibold text-gray-700">Callbacks</div>
        <div className="text-lg">{metrics.callbackExecutions || '0'}</div>
      </div>
    </div>
    
    {metrics.suggestions && metrics.suggestions.length > 0 && (
      <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
        <div className="font-semibold text-yellow-800 text-sm">Sugerencias:</div>
        <ul className="text-xs text-yellow-700 mt-1">
          {metrics.suggestions.map((suggestion: string, index: number) => (
            <li key={index}>• {suggestion}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const LogsTab: React.FC<{ logs: any[] }> = ({ logs }) => (
  <div className="space-y-2">
    {logs.length === 0 ? (
      <div className="text-gray-500 text-sm text-center py-4">
        No hay logs disponibles
      </div>
    ) : (
      logs.slice(-10).reverse().map((log, index) => (
        <div
          key={index}
          className={`text-xs p-2 rounded border-l-4 ${
            log.level === 'error' || log.level === 'critical'
              ? 'bg-red-50 border-red-400 text-red-800'
              : log.level === 'warn'
              ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
              : 'bg-gray-50 border-gray-400 text-gray-800'
          }`}
        >
          <div className="font-semibold">
            [{log.level.toUpperCase()}] {log.component}
          </div>
          <div className="mt-1">{log.message}</div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(log.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))
    )}
  </div>
);

const CallbacksTab: React.FC = () => {
  const [callbackStats, setCallbackStats] = useState<any>({});
  
  useEffect(() => {
    // En una implementación real, esto se actualizaría desde CallbackDiagnostics
    const interval = setInterval(() => {
      // Simular datos de callbacks para la demo
      setCallbackStats({
        onSignalReady: { count: 150, lastExecution: Date.now() - 1000 },
        onError: { count: 2, lastExecution: Date.now() - 30000 },
        processFrame: { count: 300, lastExecution: Date.now() - 500 }
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="space-y-3">
      {Object.entries(callbackStats).map(([name, stats]: [string, any]) => (
        <div key={name} className="bg-gray-50 p-3 rounded">
          <div className="font-semibold text-sm text-gray-700">{name}</div>
          <div className="text-xs text-gray-600 mt-1">
            Ejecutado: {stats.count} veces
          </div>
          <div className="text-xs text-gray-600">
            Última ejecución: {new Date(stats.lastExecution).toLocaleTimeString()}
          </div>
          <div className={`text-xs mt-1 ${
            Date.now() - stats.lastExecution < 5000 
              ? 'text-green-600' 
              : 'text-red-600'
          }`}>
            {Date.now() - stats.lastExecution < 5000 ? '✓ Activo' : '⚠ Inactivo'}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiagnosticOverlay;