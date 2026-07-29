import React from 'react';
import { Cpu, Lock, X, FileCheck } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLog[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="font-display font-bold text-base text-white">EVIDENCE LOG & CHAIN-OF-CUSTODY</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-center text-slate-500 py-8">NO AUDIT ENTRIES LOGGED</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-cyan-400">
                  <span className="font-bold">{log.action}</span>
                  <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-300 text-xs">
                  <span className="text-slate-500">Actor: </span>{log.actor} | <span className="text-slate-500">Target: </span>{log.target}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center space-x-1 truncate pt-1 border-t border-slate-900">
                  <Lock className="w-3 h-3 text-slate-600 flex-shrink-0" />
                  <span className="truncate">SHA-256: {log.hash}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-800 text-right bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
