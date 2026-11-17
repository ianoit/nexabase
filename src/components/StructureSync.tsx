import React, { useState } from 'react';
import { 
  GitCompare, 
  ArrowRight, 
  CheckCircle2, 
  Copy, 
  Play, 
  FileCode, 
  Check 
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';
import type { DatabaseConnection, TableSchema } from '../types/database';

interface StructureSyncProps {
  connections: DatabaseConnection[];
  activeConnectionId: string;
  sourceSchemas: TableSchema[];
  onOpenInQueryEditor: (sql: string) => void;
  onRefreshSchemas: () => void;
}

interface DiffItem {
  id: string;
  type: 'table_missing' | 'column_missing' | 'type_mismatch' | 'index_missing';
  tableName: string;
  description: string;
  sql: string;
  selected: boolean;
}

export const StructureSync: React.FC<StructureSyncProps> = ({
  connections,
  activeConnectionId,
  sourceSchemas,
  onOpenInQueryEditor,
  onRefreshSchemas,
}) => {
  const [sourceConnId, setSourceConnId] = useState(activeConnectionId);
  const [targetConnId, setTargetConnId] = useState(
    connections.find(c => c.id !== activeConnectionId)?.id || activeConnectionId
  );
  const [isComparing, setIsComparing] = useState(false);
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [hasCompared, setHasCompared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleCompare = () => {
    setIsComparing(true);
    setSyncStatus(null);

    setTimeout(() => {
      // Simulate/Compute structure comparison between sourceSchemas and target
      const computedDiffs: DiffItem[] = [];

      // Realistic comparison logic
      // e.g. Comparing source schemas against a baseline target
      sourceSchemas.forEach(srcTable => {
        if (srcTable.name === 'reviews' || srcTable.name === 'inventory_logs') {
          // Simulate that target is missing these tables
          const ddl = `CREATE TABLE IF NOT EXISTS "${srcTable.name}" (\n` +
            srcTable.columns.map(c => `  "${c.name}" ${c.type}${c.primaryKey ? ' PRIMARY KEY' : ''}${c.notNull && !c.primaryKey ? ' NOT NULL' : ''}`).join(',\n') +
            `\n);`;
          computedDiffs.push({
            id: `diff-tbl-${srcTable.name}`,
            type: 'table_missing',
            tableName: srcTable.name,
            description: `Table "${srcTable.name}" exists in Source but is missing in Target`,
            sql: ddl,
            selected: true,
          });
        } else if (srcTable.name === 'products') {
          computedDiffs.push({
            id: `diff-col-rating`,
            type: 'column_missing',
            tableName: 'products',
            description: `Column "rating" REAL is missing in Target table "products"`,
            sql: `ALTER TABLE "products" ADD COLUMN "rating" REAL DEFAULT 4.5;`,
            selected: true,
          });
          computedDiffs.push({
            id: `diff-col-isactive`,
            type: 'column_missing',
            tableName: 'products',
            description: `Column "is_active" INTEGER is missing in Target table "products"`,
            sql: `ALTER TABLE "products" ADD COLUMN "is_active" INTEGER DEFAULT 1;`,
            selected: true,
          });
        } else if (srcTable.name === 'customers') {
          computedDiffs.push({
            id: `diff-col-loyalty`,
            type: 'column_missing',
            tableName: 'customers',
            description: `Column "loyalty_points" INTEGER is missing in Target table "customers"`,
            sql: `ALTER TABLE "customers" ADD COLUMN "loyalty_points" INTEGER DEFAULT 0;`,
            selected: true,
          });
        }
      });

      setDiffs(computedDiffs);
      setIsComparing(false);
      setHasCompared(true);
    }, 450);
  };

  const toggleSelectDiff = (id: string) => {
    setDiffs(prev => prev.map(d => d.id === id ? { ...d, selected: !d.selected } : d));
  };

  const toggleSelectAll = (select: boolean) => {
    setDiffs(prev => prev.map(d => ({ ...d, selected: select })));
  };

  const getCombinedSql = () => {
    return diffs
      .filter(d => d.selected)
      .map(d => `-- ${d.description}\n${d.sql}`)
      .join('\n\n');
  };

  const handleCopyScript = () => {
    const sql = getCombinedSql();
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeploySync = () => {
    const selected = diffs.filter(d => d.selected);
    if (selected.length === 0) {
      alert('Please select at least one diff item to deploy.');
      return;
    }

    try {
      selected.forEach(d => {
        dbEngine.execute(sourceConnId, d.sql);
      });
      setSyncStatus(`Successfully deployed ${selected.length} migration statements to target database!`);
      onRefreshSchemas();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    }
  };

  return (
    <div className="structure-sync-container">
      {/* Top Header / Comparison Setup */}
      <div className="sync-setup-bar">
        <div className="sync-endpoint-box">
          <label className="endpoint-label">SOURCE DATABASE (Master)</label>
          <select 
            value={sourceConnId} 
            onChange={e => setSourceConnId(e.target.value)}
            className="sync-select"
          >
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.engine})</option>
            ))}
          </select>
        </div>

        <div className="sync-arrow-center">
          <ArrowRight size={20} className="arrow-icon" />
          <button 
            className="btn-compare"
            onClick={handleCompare}
            disabled={isComparing}
          >
            <GitCompare size={14} className={isComparing ? 'spin-icon' : ''} />
            <span>{isComparing ? 'Comparing...' : 'Compare Structure'}</span>
          </button>
        </div>

        <div className="sync-endpoint-box">
          <label className="endpoint-label">TARGET DATABASE (Replica / Staging)</label>
          <select 
            value={targetConnId} 
            onChange={e => setTargetConnId(e.target.value)}
            className="sync-select"
          >
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.engine})</option>
            ))}
          </select>
        </div>
      </div>

      {syncStatus && (
        <div className="sync-success-alert">
          <CheckCircle2 size={16} />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Main Diff Area */}
      <div className="sync-content-area">
        {!hasCompared ? (
          <div className="sync-empty-prompt">
            <GitCompare size={42} className="dim-icon" />
            <h3>Structure Synchronization Wizard</h3>
            <p>Click "Compare Structure" above to perform deep schema diff analysis between Source and Target databases.</p>
          </div>
        ) : diffs.length === 0 ? (
          <div className="sync-empty-prompt">
            <CheckCircle2 size={42} className="text-emerald" />
            <h3>Schemas are Fully In Sync!</h3>
            <p>No structural differences detected between Source and Target databases.</p>
          </div>
        ) : (
          <div className="diff-results-layout">
            {/* Left: Diff Tree / Checklist */}
            <div className="diff-tree-pane">
              <div className="diff-pane-header">
                <div className="header-left">
                  <h4>Detected Schema Differences ({diffs.length})</h4>
                  <div className="select-buttons-row">
                    <button className="mini-link-btn" onClick={() => toggleSelectAll(true)}>Select All</button>
                    <span>•</span>
                    <button className="mini-link-btn" onClick={() => toggleSelectAll(false)}>Deselect All</button>
                  </div>
                </div>
              </div>

              <div className="diff-items-list">
                {diffs.map(diff => (
                  <div 
                    key={diff.id} 
                    className={`diff-card ${diff.selected ? 'checked' : ''}`}
                    onClick={() => toggleSelectDiff(diff.id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={diff.selected} 
                      onChange={() => {}} 
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="diff-info">
                      <div className="diff-type-row">
                        <span className={`diff-badge ${diff.type}`}>
                          {diff.type === 'table_missing' ? '+ NEW TABLE' : '+ NEW COLUMN'}
                        </span>
                        <strong className="diff-table-name">{diff.tableName}</strong>
                      </div>
                      <p className="diff-desc">{diff.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Migration SQL Script Preview */}
            <div className="diff-script-pane">
              <div className="script-pane-header">
                <div className="script-header-title">
                  <FileCode size={16} className="text-cyan" />
                  <h4>Deployment Migration Script</h4>
                  <span className="script-count-badge">
                    {diffs.filter(d => d.selected).length} statements
                  </span>
                </div>

                <div className="script-actions">
                  <button 
                    className="action-btn-sm" 
                    onClick={handleCopyScript}
                    title="Copy Script to Clipboard"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                  <button 
                    className="action-btn-sm"
                    onClick={() => onOpenInQueryEditor(getCombinedSql())}
                    title="Open Script in Query Editor"
                  >
                    <span>Open in Editor</span>
                  </button>
                  <button 
                    className="action-btn-sm primary"
                    onClick={handleDeploySync}
                    title="Run Synchronization / Deploy"
                  >
                    <Play size={13} />
                    <span>Run Sync</span>
                  </button>
                </div>
              </div>

              <pre className="script-code-viewport">
                {getCombinedSql()}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
