import React, { useState } from 'react';
import { Terminal, X, AlertTriangle, UserCheck, Play } from 'lucide-react';

interface SimulatorControlsProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSOS: (name: string, locationName: string, lat: number, lng: number) => void;
  onSimulateOfficerMove: () => void;
}

const SAMPLE_LOCATIONS = [
  { name: 'Mount Road near Anna Flyover, Chennai', lat: 13.0604, lng: 80.2496 },
  { name: 'T. Nagar Ranganathan Street, Chennai', lat: 13.0405, lng: 80.2337 },
  { name: 'Marina Beach Light House Area, Chennai', lat: 13.0382, lng: 80.2798 },
  { name: 'Guindy Industrial Estate, Chennai', lat: 13.0102, lng: 80.2157 },
];

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  isOpen,
  onClose,
  onTriggerSOS,
  onSimulateOfficerMove,
}) => {
  const [selectedLocIndex, setSelectedLocIndex] = useState(0);
  const [reporterName, setReporterName] = useState('Ananya Ramachandran');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-md w-full shadow-2xl space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h3 className="font-display font-bold text-base text-white">NIRAI INCIDENT SIMULATOR</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 font-mono text-xs text-slate-300">
          <div>
            <label className="block text-slate-400 mb-1">Citizen Name:</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Simulated Location:</label>
            <select
              value={selectedLocIndex}
              onChange={(e) => setSelectedLocIndex(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
            >
              {SAMPLE_LOCATIONS.map((loc, idx) => (
                <option key={idx} value={idx}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex flex-col space-y-2">
            <button
              onClick={() => {
                const loc = SAMPLE_LOCATIONS[selectedLocIndex];
                onTriggerSOS(reporterName, loc.name, loc.lat, loc.lng);
                onClose();
              }}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center space-x-2 shadow-lg shadow-rose-950/50"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>SIMULATE CIVILIAN SOS TRIGGER</span>
            </button>

            <button
              onClick={() => {
                onSimulateOfficerMove();
                onClose();
              }}
              className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold py-2 rounded-lg transition-all flex items-center justify-center space-x-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>UPDATE POLICE OFFICER GPS HEARTBEAT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
