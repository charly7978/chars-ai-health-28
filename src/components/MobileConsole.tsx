import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}

interface MobileConsoleProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Consola visual para ver logs en dispositivos móviles
 */
const MobileConsole: React.FC<MobileConsoleProps> = ({ isVisible, onToggle }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const logIdRef = useRef(0);
  const maxLogs = 50;

  // Interceptar console.log para mostrar en la consola visual
  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: LogEntry['level'], message: string, ...args: any[]) => {
      const logEntry: LogEntry = {
        id: logIdRef.current++,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        data: args.length > 0 ? args : undefined
      };

      setLogs(prev => {
        const newLogs = [...prev, logEntry];
        return newLogs.slice(-maxLogs); // Mantener solo los últimos logs
      });
    };

    // Interceptar console methods
    console.log = (message: any, ...args: any[]) => {
      originalLog(message, ...args);
      
      // Solo capturar logs relevantes para el diagnóstico
      const messageStr = String(message);
      if (messageStr.includes('🟡') || messageStr.includes('🟢') || 
          messageStr.includes('🔵') || messageStr.includes('🟠') || 
          messageStr.includes('[DIAG]') || messageStr.includes('processImage') ||
          messageStr.includes('processFrame') || messageStr.includes('lastSignal')) {
        addLog('info', messageStr, ...args);
      }
    };

    console.warn = (message: any, ...args: any[]) => {
      originalWarn(message, ...args);
      addLog('warn', String(message), ...args);
    };

    console.error = (message: any, ...args: any[]) => {
      originalError(message, ...args);
      addLog('error', String(message), ...args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 left-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-full text-sm font-bold shadow-lg"
        style={{ zIndex: 9999 }}
      >
        📱 LOGS
      </button>
    );
  }

  return (
    <div className={`fixed inset-x-0 z-50 bg-black bg-opacity-95 text-white ${
      isMinimized ? 'bottom-0 h-16' : 'bottom-0 h-80'
    } transition-all duration-300`}>
      {/* Header */}
      <div className="flex justify-between items-center p-2 bg-blue-600">
        <h3 className="font-bold text-sm">📱 CONSOLA MÓVIL ({logs.length})</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white hover:text-gray-200 text-sm px-2 py-1 bg-blue-700 rounded"
          >
            {isMinimized ? '⬆️' : '⬇️'}
          </button>
          <button
            onClick={() => setLogs([])}
            className="text-white hover:text-gray-200 text-sm px-2 py-1 bg-red-600 rounded"
          >
            🗑️
          </button>
          <button
            onClick={onToggle}
            className="text-white hover:text-gray-200 text-sm px-2 py-1 bg-gray-600 rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div className="h-full overflow-y-auto p-2 text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-400 text-center py-4">
              No hay logs aún. Inicia una medición para ver el flujo de datos.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`mb-1 p-1 rounded border-l-2 ${
                  log.level === 'error' 
                    ? 'border-red-500 bg-red-900 bg-opacity-20' 
                    : log.level === 'warn'
                    ? 'border-yellow-500 bg-yellow-900 bg-opacity-20'
                    : log.level === 'success'
                    ? 'border-green-500 bg-green-900 bg-opacity-20'
                    : 'border-blue-500 bg-blue-900 bg-opacity-20'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-gray-300 text-xs">{log.timestamp}</span>
                  <span className={`text-xs px-1 rounded ${
                    log.level === 'error' ? 'bg-red-600' :
                    log.level === 'warn' ? 'bg-yellow-600' :
                    log.level === 'success' ? 'bg-green-600' :
                    'bg-blue-600'
                  }`}>
                    {log.level.toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 break-words">
                  {log.message}
                </div>
                {log.data && (
                  <div className="mt-1 text-gray-400 text-xs">
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Minimized view */}
      {isMinimized && (
        <div className="p-2 text-xs">
          <div className="flex justify-between items-center">
            <span>Últimos logs: {logs.slice(-3).map(l => l.message.substring(0, 20)).join(' | ')}</span>
            <span className="text-gray-400">{logs.length} total</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileConsole;