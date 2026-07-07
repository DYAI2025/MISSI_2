import React, { useState, useEffect } from 'react';
import { RunManifest } from '../types/index.js';
import { History, Eye, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface RunHistoryProps {
  onLoadHistoryList: () => Promise<{ id: string; startTime: string; scenarioTitle: string; status: string }[]>;
  onLoadRunDetails: (id: string) => Promise<RunManifest | null>;
}

export const RunHistory: React.FC<RunHistoryProps> = ({
  onLoadHistoryList,
  onLoadRunDetails,
}) => {
  const [runs, setRuns] = useState<{ id: string; startTime: string; scenarioTitle: string; status: string }[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunManifest | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchRuns = async () => {
    setIsLoadingList(true);
    try {
      const list = await onLoadHistoryList();
      setRuns(list);
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleSelectRun = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const details = await onLoadRunDetails(id);
      setSelectedRun(details);
    } catch (err) {
      console.error('Failed to load run details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-brand-green" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />;
    }
  };

  return (
    <div id="run-history" className="bg-brand-aside border border-brand-border rounded-none p-4 shadow-none flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-brand-green" />
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-brand-muted font-bold">Historical Audit Logs // VERIFY</h2>
        </div>
        <button
          onClick={fetchRuns}
          disabled={isLoadingList}
          className="p-1 border border-brand-border bg-brand-bg text-brand-muted hover:text-brand-text hover:bg-brand-border-light rounded-none transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-grow">
        {/* Run list */}
        <div className="lg:col-span-1 space-y-2 overflow-y-auto max-h-[350px] pr-2">
          <span className="text-[10px] text-brand-muted font-mono uppercase tracking-wider block mb-1.5 font-bold">// MANIFESTS_INDEX</span>
          {runs.length > 0 ? (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => handleSelectRun(run.id)}
                className={`w-full text-left p-3 rounded-none border text-xs transition-all flex items-center justify-between font-mono ${
                  selectedRun?.id === run.id
                    ? 'bg-brand-green/10 border-brand-green text-brand-text'
                    : 'bg-brand-bg hover:bg-brand-border-light border-brand-border text-brand-muted hover:text-brand-text'
                }`}
              >
                <div className="space-y-1 truncate max-w-[80%]">
                  <div className="font-bold text-brand-text truncate uppercase">{run.scenarioTitle}</div>
                  <div className="text-[9px] opacity-60 font-mono text-brand-muted">{new Date(run.startTime).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {getStatusIcon(run.status)}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center p-6 text-brand-muted italic text-[10px] border border-dashed border-brand-border rounded-none uppercase font-mono">
              No historical runs captured.
            </div>
          )}
        </div>

        {/* Detailed audit logs */}
        <div className="lg:col-span-2 flex flex-col bg-brand-bg border border-brand-border rounded-none overflow-hidden min-h-[300px]">
          {isLoadingDetail ? (
            <div className="h-full flex items-center justify-center text-brand-muted py-16 font-mono text-[10px] uppercase gap-1.5">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-green" /> Reading run manifest details...
            </div>
          ) : selectedRun ? (
            <div className="flex flex-col h-full">
              {/* Manifest Metadata */}
              <div className="bg-brand-panel border-b border-brand-border p-3.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-[9px] font-mono text-brand-green font-bold uppercase">MANIFEST_ID // {selectedRun.id}</h3>
                    <h2 className="text-xs font-bold text-brand-text mt-1 uppercase font-mono">{selectedRun.scenarioTitle}</h2>
                  </div>
                  <span className={`text-[10px] font-mono font-bold border rounded-none px-1.5 py-0.5 ${
                    selectedRun.status === 'completed' ? 'bg-brand-green/10 text-brand-green border-brand-green/30' : 'bg-red-950/40 text-red-300 border-red-800/40'
                  }`}>
                    {selectedRun.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] text-brand-muted mt-2.5 font-mono uppercase">
                  <div>Started: {new Date(selectedRun.startTime).toLocaleString()}</div>
                  {selectedRun.endTime && (
                    <div>Ended: {new Date(selectedRun.endTime).toLocaleString()}</div>
                  )}
                  <div>Seed: {selectedRun.serverConfig.seed}</div>
                  <div>Events Count: {selectedRun.logs.length}</div>
                </div>
              </div>

              {/* Historical logs list */}
              <div className="p-3.5 overflow-y-auto max-h-[300px] text-[10px] font-mono space-y-1.5 bg-brand-bg">
                {selectedRun.logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-brand-text leading-relaxed">
                    <span className="text-[9px] text-brand-muted select-none shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-brand-green font-bold shrink-0">
                      [{log.type.toUpperCase()}]
                    </span>
                    {log.botName && (
                      <span className="text-purple-400 font-bold shrink-0">
                        [{log.botName}]
                      </span>
                    )}
                    <span className="break-all whitespace-pre-wrap">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-brand-muted italic text-center py-20 text-[10px] uppercase font-mono">
              <Eye className="w-6 h-6 text-brand-border mb-2" />
              <span>Select completed run manifest to inspect audit logs</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
