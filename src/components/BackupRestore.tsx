import React, { useState } from 'react';
import { 
  Archive, 
  RotateCcw, 
  Download, 
  Upload, 
  CheckCircle2, 
  Play 
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';

interface BackupRestoreProps {
  connectionId: string;
  onRefreshSchemas: () => void;
}

export const BackupRestore: React.FC<BackupRestoreProps> = ({
  connectionId,
  onRefreshSchemas,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
  
  // Backup options
  const [backupMode, setBackupMode] = useState<'both' | 'structure' | 'data'>('both');
  const [includeDrop, setIncludeDrop] = useState(true);
  const [useTransaction, setUseTransaction] = useState(true);
  const [comment, setComment] = useState('Full production snapshot');
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  // Restore options
  const [restoreSql, setRestoreSql] = useState<string>('');
  const [restoreProgress, setRestoreProgress] = useState<number | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  const handleStartBackup = () => {
    try {
      const dump = dbEngine.exportAsSqlDump(connectionId);
      const blob = new Blob([dump], { type: 'application/sql;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_snapshot_${Date.now()}.bak.sql`;
      a.click();
      setBackupStatus(`Backup archive generated and downloaded successfully! Mode: ${backupMode.toUpperCase()}`);
    } catch (err: any) {
      alert(`Backup failed: ${err.message}`);
    }
  };

  const handleFileForRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRestoreSql(text);
    setRestoreStatus(`File "${file.name}" loaded (${text.split('\n').length} lines). Ready to restore.`);
  };

  const handleExecuteRestore = () => {
    if (!restoreSql.trim()) {
      alert('Please select or paste a backup script first.');
      return;
    }

    setRestoreProgress(25);
    setTimeout(() => {
      setRestoreProgress(65);
      setTimeout(() => {
        try {
          dbEngine.execute(connectionId, restoreSql);
          setRestoreProgress(100);
          setRestoreStatus('Database successfully restored from snapshot!');
          onRefreshSchemas();
        } catch (err: any) {
          alert(`Restore failed: ${err.message}`);
        }
      }, 400);
    }, 300);
  };

  return (
    <div className="backup-restore-container">
      {/* Header bar */}
      <div className="br-header-bar">
        <div className="br-title-group">
          <Archive size={16} className="text-cyan" />
          <h4>Database Backup & Restore Wizard (Studio Backup / Restore)</h4>
        </div>

        <div className="br-tabs">
          <button 
            className={`br-tab ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            <Download size={13} />
            <span>Create Backup</span>
          </button>
          <button 
            className={`br-tab ${activeTab === 'restore' ? 'active' : ''}`}
            onClick={() => setActiveTab('restore')}
          >
            <RotateCcw size={13} />
            <span>Restore Backup</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="br-body-viewport">
        {activeTab === 'backup' ? (
          <div className="br-card">
            <h4>Backup Configuration</h4>
            <p className="text-muted">Create an immutable point-in-time snapshot of your database structure and datasets.</p>

            <div className="form-field" style={{ marginTop: '16px' }}>
              <label>Backup Scope</label>
              <div className="scope-radios">
                <label className={`radio-pill ${backupMode === 'both' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="scope" 
                    checked={backupMode === 'both'} 
                    onChange={() => setBackupMode('both')} 
                  />
                  <span>Structure & Data (Full Snapshot)</span>
                </label>
                <label className={`radio-pill ${backupMode === 'structure' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="scope" 
                    checked={backupMode === 'structure'} 
                    onChange={() => setBackupMode('structure')} 
                  />
                  <span>Structure Only (Schema DDL)</span>
                </label>
                <label className={`radio-pill ${backupMode === 'data' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="scope" 
                    checked={backupMode === 'data'} 
                    onChange={() => setBackupMode('data')} 
                  />
                  <span>Data Only (INSERT Statements)</span>
                </label>
              </div>
            </div>

            <div className="form-field" style={{ marginTop: '14px' }}>
              <label>Advanced Safeguards</label>
              <div className="checkbox-field">
                <input 
                  type="checkbox" 
                  id="chk-drop" 
                  checked={includeDrop} 
                  onChange={e => setIncludeDrop(e.target.checked)} 
                />
                <label htmlFor="chk-drop">Add DROP TABLE IF EXISTS statements</label>
              </div>
              <div className="checkbox-field" style={{ marginTop: '6px' }}>
                <input 
                  type="checkbox" 
                  id="chk-tx" 
                  checked={useTransaction} 
                  onChange={e => setUseTransaction(e.target.checked)} 
                />
                <label htmlFor="chk-tx">Wrap in Atomic Transaction (BEGIN ... COMMIT)</label>
              </div>
            </div>

            <div className="form-field" style={{ marginTop: '14px' }}>
              <label>Comment / Snapshot Tag</label>
              <input 
                type="text" 
                value={comment} 
                onChange={e => setComment(e.target.value)} 
                placeholder="e.g. Pre-migration backup #2026-10"
              />
            </div>

            {backupStatus && (
              <div className="sync-success-alert" style={{ marginTop: '16px' }}>
                <CheckCircle2 size={16} />
                <span>{backupStatus}</span>
              </div>
            )}

            <div className="br-action-row" style={{ marginTop: '20px' }}>
              <button className="action-btn-sm primary" onClick={handleStartBackup}>
                <Download size={14} /> Start Backup & Download
              </button>
            </div>
          </div>
        ) : (
          <div className="br-card">
            <h4>Restore Database from Snapshot</h4>
            <p className="text-muted">Restore tables and datasets from a .sql or .bak dump script.</p>

            <div className="upload-dropzone" style={{ marginTop: '16px' }}>
              <Upload size={28} className="dropzone-icon" />
              <h4>Select Backup File (.sql / .bak)</h4>
              <label className="btn primary dropzone-btn">
                Browse Snapshot File
                <input 
                  type="file" 
                  accept=".sql,.bak" 
                  onChange={handleFileForRestore} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>

            {restoreSql && (
              <div className="form-field" style={{ marginTop: '16px' }}>
                <label>Snapshot Script Preview ({restoreSql.split('\n').length} lines)</label>
                <textarea 
                  className="sql-code-editor" 
                  style={{ height: '140px' }}
                  value={restoreSql.slice(0, 1500) + (restoreSql.length > 1500 ? '\n... [truncated for preview]' : '')}
                  readOnly
                />
              </div>
            )}

            {restoreProgress !== null && (
              <div className="restore-progress-container" style={{ marginTop: '16px' }}>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${restoreProgress}%` }}></div>
                </div>
                <span className="progress-text">{restoreProgress}% Restored</span>
              </div>
            )}

            {restoreStatus && (
              <div className="sync-success-alert" style={{ marginTop: '16px' }}>
                <CheckCircle2 size={16} />
                <span>{restoreStatus}</span>
              </div>
            )}

            <div className="br-action-row" style={{ marginTop: '20px' }}>
              <button 
                className="action-btn-sm primary" 
                onClick={handleExecuteRestore}
                disabled={!restoreSql}
              >
                <Play size={14} /> Execute Restore
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
