import React from 'react';
import { 
  Info, 
  Table as TableIcon, 
  Key, 
  Link2, 
  Database, 
  PenTool, 
  Terminal, 
  ExternalLink 
} from 'lucide-react';
import type { TableSchema } from '../types/database';

interface ObjectInspectorProps {
  selectedSchema: TableSchema | null;
  activeConnectionName: string;
  onOpenTableData: (tableName: string) => void;
  onDesignTable: (tableName: string) => void;
  onNewQuery: (sql: string) => void;
}

export const ObjectInspector: React.FC<ObjectInspectorProps> = ({
  selectedSchema,
  activeConnectionName,
  onOpenTableData,
  onDesignTable,
  onNewQuery,
}) => {
  return (
    <aside className="studio-inspector-pane">
      {/* Top Inspector Header with exact Blue (i) Badge */}
      <div className="inspector-header">
        <div className="info-icon-circle" title="Object Properties">
          <Info size={15} />
        </div>
      </div>

      {/* Inspector Body */}
      <div className="inspector-content">
        {!selectedSchema ? (
          <div className="no-info-state">
            <span>No Info</span>
          </div>
        ) : (
          <div className="object-info-details">
            {/* Object Title Header */}
            <div className="info-title-block">
              <div className="info-icon-badge">
                <TableIcon size={20} className="text-cyan" />
              </div>
              <div className="info-title-text">
                <h4 className="obj-heading">{selectedSchema.name}</h4>
                <span className="obj-subheading">BASE TABLE</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="info-actions-strip">
              <button 
                className="inspector-action-btn primary"
                onClick={() => onOpenTableData(selectedSchema.name)}
                title="Open Table in Data Grid"
              >
                <ExternalLink size={13} />
                <span>Open Table</span>
              </button>
              <button 
                className="inspector-action-btn"
                onClick={() => onDesignTable(selectedSchema.name)}
                title="Design Structure"
              >
                <PenTool size={13} />
                <span>Design</span>
              </button>
              <button 
                className="inspector-action-btn"
                onClick={() => onNewQuery(`SELECT * FROM "${selectedSchema.name}" LIMIT 50;`)}
                title="Query Table"
              >
                <Terminal size={13} />
                <span>Query</span>
              </button>
            </div>

            {/* General Properties Grid */}
            <div className="info-section">
              <div className="section-header">General Information</div>
              <div className="property-grid">
                <div className="property-row">
                  <span className="prop-label">Database:</span>
                  <span className="prop-val text-truncate">{activeConnectionName}</span>
                </div>
                <div className="property-row">
                  <span className="prop-label">Engine:</span>
                  <span className="prop-val">SQLite 3 / WASM</span>
                </div>
                <div className="property-row">
                  <span className="prop-label">Rows:</span>
                  <span className="prop-val highlight">{(selectedSchema.rowCount ?? 0).toLocaleString()}</span>
                </div>
                <div className="property-row">
                  <span className="prop-label">Data Size:</span>
                  <span className="prop-val">{Math.max(4, (selectedSchema.rowCount ?? 0) * 4)} KB</span>
                </div>
                <div className="property-row">
                  <span className="prop-label">Index Size:</span>
                  <span className="prop-val">{(selectedSchema.indexes?.length || 0) * 8} KB</span>
                </div>
                <div className="property-row">
                  <span className="prop-label">Collation:</span>
                  <span className="prop-val">utf8mb4_unicode_ci</span>
                </div>
                <div className="property-row">
                  <span className="prop-label">Created:</span>
                  <span className="prop-val">2026-10-21 08:00</span>
                </div>
              </div>
            </div>

            {/* Columns Section */}
            <div className="info-section">
              <div className="section-header">
                <span>Columns</span>
                <span className="header-count">({selectedSchema.columns?.length || 0})</span>
              </div>
              <div className="inspector-columns-list">
                {(selectedSchema.columns || []).map((col) => {
                  const isPk = col.primaryKey || (col as any).isPk;
                  const isFk = (selectedSchema.foreignKeys || []).some(fk => fk.from === col.name);
                  const colType = col.type || (col as any).dataType || 'TEXT';
                  return (
                    <div key={col.name} className="col-info-row">
                      <div className="col-name-group">
                        {isPk ? (
                          <span title="Primary Key"><Key size={12} className="pk-badge-icon" /></span>
                        ) : isFk ? (
                          <span title="Foreign Key"><Link2 size={12} className="fk-badge-icon" /></span>
                        ) : (
                          <span className="col-bullet">•</span>
                        )}
                        <span className={`col-name-label ${isPk ? 'is-pk' : ''}`}>
                          {col.name}
                        </span>
                      </div>
                      <span className="col-type-tag">{colType}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Indexes Section */}
            {(selectedSchema.indexes?.length || 0) > 0 && (
              <div className="info-section">
                <div className="section-header">
                  <span>Indexes</span>
                  <span className="header-count">({selectedSchema.indexes?.length || 0})</span>
                </div>
                <div className="inspector-indexes-list">
                  {(selectedSchema.indexes || []).map((idx) => (
                    <div key={idx.name} className="idx-info-row">
                      <Database size={11} className="idx-icon" />
                      <span className="idx-name">{idx.name}</span>
                      {idx.unique && <span className="idx-unique-badge">UNIQUE</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
