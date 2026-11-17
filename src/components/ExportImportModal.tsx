import React, { useState } from 'react';
import { 
  ArrowUpDown, 
  Download, 
  Upload, 
  X, 
  FileText, 
  Database, 
  CheckCircle2, 
  FileCode 
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';
import type { TableSchema } from '../types/database';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  schemas: TableSchema[];
  onDataImported: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  schemas,
  onDataImported,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [selectedTable, setSelectedTable] = useState<string>(schemas[0]?.name || 'customers');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'sql' | 'sqlite'>('csv');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    if (exportFormat === 'csv') {
      const csv = dbEngine.exportTableAsCsv(connectionId, selectedTable);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable}.csv`;
      a.click();
    } else if (exportFormat === 'json') {
      const json = dbEngine.exportTableAsJson(connectionId, selectedTable);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable}.json`;
      a.click();
    } else if (exportFormat === 'sql') {
      const sqlDump = dbEngine.exportAsSqlDump(connectionId);
      const blob = new Blob([sqlDump], { type: 'application/sql;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database_dump_${Date.now()}.sql`;
      a.click();
    } else if (exportFormat === 'sqlite') {
      const binary = dbEngine.exportToFile(connectionId);
      const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database_${Date.now()}.sqlite`;
      a.click();
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.sql')) {
      const text = await file.text();
      try {
        dbEngine.execute(connectionId, text);
        setImportStatus(`Successfully executed SQL script "${file.name}"!`);
        onDataImported();
      } catch (err: any) {
        alert(`SQL Import failed: ${err.message}`);
      }
    } else if (file.name.endsWith('.csv')) {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const rowVals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const rowObj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = rowVals[idx];
          });
          try {
            dbEngine.insertRow(connectionId, selectedTable, rowObj);
            count++;
          } catch {
            // ignore row insert errors
          }
        }
        setImportStatus(`Imported ${count} rows into "${selectedTable}" from CSV!`);
        onDataImported();
      }
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container export-import-modal">
        <div className="modal-header">
          <div className="modal-title-row">
            <ArrowUpDown className="modal-icon text-cyan" />
            <h3>Export & Import Wizard (Studio Data Transfer)</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Wizard Tabs */}
        <div className="dialog-tabs-bar">
          <button 
            className={`dialog-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={13} />
            <span>Export Wizard</span>
          </button>
          <button 
            className={`dialog-tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <Upload size={13} />
            <span>Import Wizard</span>
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'export' ? (
            <div className="wizard-step">
              <div className="form-field">
                <label>Select Table to Export</label>
                <select 
                  value={selectedTable} 
                  onChange={e => setSelectedTable(e.target.value)}
                  className="modal-select"
                >
                  {schemas.map(s => (
                    <option key={s.name} value={s.name}>{s.name} ({s.rowCount ?? 0} rows)</option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Choose Export Format</label>
                <div className="export-format-options">
                  <div 
                    className={`format-option-card ${exportFormat === 'csv' ? 'selected' : ''}`}
                    onClick={() => setExportFormat('csv')}
                  >
                    <FileText size={20} className="fmt-icon text-emerald" />
                    <strong>CSV Format</strong>
                    <span>Spreadsheets, Excel & Pandas</span>
                  </div>

                  <div 
                    className={`format-option-card ${exportFormat === 'json' ? 'selected' : ''}`}
                    onClick={() => setExportFormat('json')}
                  >
                    <FileCode size={20} className="fmt-icon text-amber" />
                    <strong>JSON Format</strong>
                    <span>Web APIs & MongoDB BSON</span>
                  </div>

                  <div 
                    className={`format-option-card ${exportFormat === 'sql' ? 'selected' : ''}`}
                    onClick={() => setExportFormat('sql')}
                  >
                    <FileCode size={20} className="fmt-icon text-cyan" />
                    <strong>SQL Dump</strong>
                    <span>Full DDL + INSERT statements</span>
                  </div>

                  <div 
                    className={`format-option-card ${exportFormat === 'sqlite' ? 'selected' : ''}`}
                    onClick={() => setExportFormat('sqlite')}
                  >
                    <Database size={20} className="fmt-icon text-indigo" />
                    <strong>SQLite Binary</strong>
                    <span>Native .sqlite binary snapshot</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="wizard-step">
              <div className="form-field">
                <label>Target Destination Table</label>
                <select 
                  value={selectedTable} 
                  onChange={e => setSelectedTable(e.target.value)}
                  className="modal-select"
                >
                  {schemas.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="upload-dropzone">
                <Upload size={32} className="dropzone-icon" />
                <h4>Select File to Import</h4>
                <p>Supports .csv files and .sql dump scripts.</p>
                <label className="btn primary dropzone-btn">
                  Browse File
                  <input 
                    type="file" 
                    accept=".csv,.sql" 
                    onChange={handleFileImport}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {importStatus && (
                <div className="connection-feedback success">
                  <CheckCircle2 size={16} />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer-row">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          {activeTab === 'export' && (
            <button type="button" className="btn primary" onClick={handleExport}>
              <Download size={14} />
              <span>Download Export</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
