import React, { useState } from 'react';
import { 
  PenTool, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Code
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';
import type { TableSchema, ColumnDefinition } from '../types/database';

interface TableDesignerProps {
  connectionId: string;
  tableName: string;
  initialSchema: TableSchema | null;
  onSaved: () => void;
}

const COMMON_TYPES = [
  'INTEGER',
  'VARCHAR(100)',
  'VARCHAR(255)',
  'TEXT',
  'REAL',
  'BOOLEAN',
  'DATETIME',
  'BLOB',
];

export const TableDesigner: React.FC<TableDesignerProps> = ({
  connectionId,
  tableName: initTableName,
  initialSchema,
  onSaved,
}) => {
  const [tableName, setTableName] = useState(initTableName || 'new_table');
  const [columns, setColumns] = useState<ColumnDefinition[]>(() => {
    if (initialSchema?.columns && initialSchema.columns.length > 0) {
      return initialSchema.columns.map((c: any) => ({
        name: c.name,
        type: c.type || c.dataType || 'VARCHAR(255)',
        notNull: c.notNull !== undefined ? c.notNull : !c.isNullable,
        primaryKey: Boolean(c.primaryKey || c.isPk),
        autoIncrement: Boolean(c.autoIncrement || (c.type || c.dataType || '').toLowerCase().includes('auto_increment')),
        defaultValue: c.defaultValue ?? null,
      }));
    }
    return [
      { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true, autoIncrement: true },
      { name: 'title', type: 'VARCHAR(150)', notNull: true, primaryKey: false },
      { name: 'created_at', type: 'DATETIME', notNull: false, primaryKey: false, defaultValue: 'CURRENT_TIMESTAMP' },
    ];
  });
  const [activeTab, setActiveTab] = useState<'columns' | 'sql'>('columns');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleAddColumn = () => {
    setColumns(prev => [
      ...prev,
      {
        name: `col_${prev.length + 1}`,
        type: 'VARCHAR(100)',
        notNull: false,
        primaryKey: false,
      },
    ]);
  };

  const handleRemoveColumn = (idx: number) => {
    if (columns.length <= 1) return;
    setColumns(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateColumn = (idx: number, patch: Partial<ColumnDefinition>) => {
    setColumns(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const generateDdl = () => {
    const colDefs = columns.map(c => {
      const cType = c.type || (c as any).dataType || 'TEXT';
      let def = `  "${c.name}" ${cType}`;
      if (c.primaryKey) def += ' PRIMARY KEY';
      if (c.autoIncrement && cType.toUpperCase().includes('INT')) def += ' AUTOINCREMENT';
      if (c.notNull && !c.primaryKey) def += ' NOT NULL';
      if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
      return def;
    });

    return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${colDefs.join(',\n')}\n);`;
  };

  const handleSaveSchema = () => {
    try {
      const ddl = generateDdl();
      dbEngine.execute(connectionId, ddl);
      setSaveStatus('Table schema saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
      onSaved();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="table-designer-container">
      {/* Header bar */}
      <div className="designer-header-bar">
        <div className="designer-title-group">
          <PenTool size={16} />
          <div className="table-name-input-group">
            <label>Table Name:</label>
            <input 
              type="text" 
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              className="table-name-input"
            />
          </div>
        </div>

        <div className="designer-tabs">
          <button 
            className={`des-tab ${activeTab === 'columns' ? 'active' : ''}`}
            onClick={() => setActiveTab('columns')}
          >
            Columns ({columns.length})
          </button>
          <button 
            className={`des-tab ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <Code size={13} />
            <span>SQL DDL Preview</span>
          </button>
        </div>

        <div className="designer-actions">
          <button className="btn-sm" onClick={handleAddColumn}>
            <Plus size={13} /> Add Column
          </button>
          <button className="btn-sm primary" onClick={handleSaveSchema}>
            <Save size={13} /> Save Schema
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="designer-alert-success">
          <CheckCircle2 size={15} />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Main Designer Content */}
      <div className="designer-body-viewport">
        {activeTab === 'columns' ? (
          <table className="designer-columns-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Column Name</th>
                <th>Data Type</th>
                <th style={{ width: '90px' }}>Primary Key</th>
                <th style={{ width: '90px' }}>Not Null</th>
                <th style={{ width: '100px' }}>Auto Inc</th>
                <th>Default Value</th>
                <th style={{ width: '60px' }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, idx) => (
                <tr key={idx}>
                  <td className="center-cell">{idx + 1}</td>
                  <td>
                    <input 
                      type="text" 
                      value={col.name}
                      onChange={e => handleUpdateColumn(idx, { name: e.target.value })}
                      className="des-input"
                    />
                  </td>
                  <td>
                    <select
                      value={col.type || (col as any).dataType || 'VARCHAR(255)'}
                      onChange={e => handleUpdateColumn(idx, { type: e.target.value })}
                      className="des-select"
                    >
                      {COMMON_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      {col.type && !COMMON_TYPES.includes(col.type) && (
                        <option key={col.type} value={col.type}>{col.type}</option>
                      )}
                    </select>
                  </td>
                  <td className="center-cell">
                    <input 
                      type="checkbox" 
                      checked={Boolean(col.primaryKey || (col as any).isPk)}
                      onChange={e => handleUpdateColumn(idx, { primaryKey: e.target.checked })}
                    />
                  </td>
                  <td className="center-cell">
                    <input 
                      type="checkbox" 
                      checked={Boolean(col.notNull || (col as any).isNullable === false)}
                      onChange={e => handleUpdateColumn(idx, { notNull: e.target.checked })}
                    />
                  </td>
                  <td className="center-cell">
                    <input 
                      type="checkbox" 
                      checked={Boolean(col.autoIncrement)}
                      onChange={e => handleUpdateColumn(idx, { autoIncrement: e.target.checked })}
                      disabled={!String(col.type || (col as any).dataType || '').toUpperCase().includes('INT')}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      value={col.defaultValue || ''}
                      placeholder="NULL"
                      onChange={e => handleUpdateColumn(idx, { defaultValue: e.target.value || null })}
                      className="des-input"
                    />
                  </td>
                  <td className="center-cell">
                    <button 
                      className="del-col-btn"
                      onClick={() => handleRemoveColumn(idx)}
                      disabled={columns.length <= 1}
                      title="Delete Column"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sql-ddl-preview-pane">
            <div className="ddl-pane-header">
              <span>Auto-Generated DDL Script (Compatible with SQLite / Postgres / MySQL)</span>
            </div>
            <pre className="ddl-code-block">{generateDdl()}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
