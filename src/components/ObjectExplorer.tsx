import React, { useState } from 'react';
import { 
  FolderPlus, 
  PenTool, 
  PlusCircle, 
  MinusCircle, 
  Undo2, 
  Redo2, 
  RefreshCw, 
  List, 
  LayoutGrid, 
  Search, 
  Table as TableIcon,
  Eye,
  Share2,
  BarChart3,
  RotateCcw,
  Workflow,
  Zap,
  Bot,
  User
} from 'lucide-react';
import type { 
  TableSchema, 
  ViewDefinition, 
  ProcedureDefinition, 
  FunctionDefinition, 
  TriggerDefinition 
} from '../types/database';
import type { StudioSection } from './StudioToolbar';

interface ObjectExplorerProps {
  activeSection: StudioSection;
  schemas: TableSchema[];
  views?: ViewDefinition[];
  procedures?: ProcedureDefinition[];
  functions?: FunctionDefinition[];
  triggers?: TriggerDefinition[];
  selectedSchema: TableSchema | null;
  onSelectSchema: (schema: TableSchema) => void;
  onOpenTableData: (tableName: string) => void;
  onOpenViewData?: (viewName: string) => void;
  onDesignTable: (tableName: string) => void;
  onOpenSqlDefinition?: (title: string, sql?: string) => void;
  onNewTable: () => void;
  onNewObject?: (section: StudioSection) => void;
  onDropTable: (tableName: string) => void;
  onDropObject?: (section: StudioSection, name: string) => void;
  onRefreshSchemas: () => void;
  onOpenNewQuery?: () => void;
  onOpenQuery?: (title: string, sql?: string) => void;
  onOpenModel?: () => void;
  onOpenChart?: () => void;
  onOpenBackup?: () => void;
  onOpenUserManager?: () => void;
  activeConnectionName?: string;
}

export const ObjectExplorer: React.FC<ObjectExplorerProps> = ({
  activeSection,
  schemas,
  views = [],
  procedures = [],
  functions = [],
  triggers = [],
  selectedSchema,
  onSelectSchema,
  onOpenTableData,
  onOpenViewData,
  onDesignTable,
  onOpenSqlDefinition,
  onNewTable,
  onNewObject,
  onDropTable,
  onDropObject,
  onRefreshSchemas,
  onOpenNewQuery,
  onOpenQuery,
  onOpenModel,
  onOpenChart,
  onOpenBackup,
  onOpenUserManager,
  activeConnectionName = 'Localhost',
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  const [savedQueries, setSavedQueries] = useState<Array<{ id: string; name: string; sql: string; lastRun: string }>>(() => {
    try {
      const raw = localStorage.getItem('nexabase_saved_queries') || localStorage.getItem('dmtools_saved_queries');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      { id: 'q-1', name: 'Sales Analysis and Inventory Value', sql: 'SELECT * FROM products LIMIT 10;', lastRun: 'Today at 08:05' },
      { id: 'q-2', name: 'Recent Activity and Audit Log', sql: 'SELECT * FROM users ORDER BY created_at DESC LIMIT 50;', lastRun: 'Today at 09:12' },
      { id: 'q-3', name: 'Database Summary & Object Counts', sql: 'SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE();', lastRun: 'Yesterday at 17:30' },
    ];
  });

  const automationTasks = [
    { id: 'a-1', name: 'Daily Automated Database Backup', schedule: '0 2 * * *', status: 'Active', lastRun: 'Today at 02:00' },
    { id: 'a-2', name: 'Nightly Temp Tables & Session Cleanup', schedule: '0 3 * * 0', status: 'Active', lastRun: 'Yesterday at 03:00' },
    { id: 'a-3', name: 'Index Defragmentation & Optimize', schedule: '0 4 1 * *', status: 'Idle', lastRun: '2026-10-01 04:00' },
  ];

  const dbUsers = [
    { name: 'root', host: 'localhost', privileges: 'ALL PRIVILEGES, GRANT OPTION' },
    { name: 'admin', host: '%', privileges: 'SELECT, INSERT, UPDATE, DELETE, CREATE, DROP' },
    { name: 'app_user', host: '127.0.0.1', privileges: 'SELECT, INSERT, UPDATE, DELETE' },
    { name: 'analytics_ro', host: '%', privileges: 'SELECT (Read Only)' },
  ];

  const filteredSchemas = schemas.filter(s => 
    s.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredViews = views.filter(v =>
    v.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredProcedures = procedures.filter(p =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredFunctions = functions.filter(f =>
    f.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredTriggers = triggers.filter(t =>
    t.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredQueries = savedQueries.filter(q =>
    q.name.toLowerCase().includes(searchFilter.toLowerCase()) || q.sql.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleNew = () => {
    if (activeSection === 'table') {
      onNewTable();
    } else if (activeSection === 'query') {
      onOpenNewQuery ? onOpenNewQuery() : onOpenSqlDefinition?.('New Query', 'SELECT * FROM ');
    } else if (activeSection === 'model') {
      onOpenModel ? onOpenModel() : onNewObject?.('model');
    } else if (activeSection === 'charts') {
      onOpenChart ? onOpenChart() : onNewObject?.('charts');
    } else if (activeSection === 'backup') {
      onOpenBackup ? onOpenBackup() : onNewObject?.('backup');
    } else if (activeSection === 'user') {
      onOpenUserManager ? onOpenUserManager() : onNewObject?.('user');
    } else if (onNewObject) {
      onNewObject(activeSection);
    }
  };

  const handleDelete = () => {
    if (activeSection === 'table' && selectedSchema) {
      onDropTable(selectedSchema.name);
    } else if (activeSection === 'query' && selectedItemName) {
      if (confirm(`Delete saved query "${selectedItemName}"?`)) {
        const next = savedQueries.filter(q => q.name !== selectedItemName);
        setSavedQueries(next);
        try { localStorage.setItem('nexabase_saved_queries', JSON.stringify(next)); } catch (e) {}
        setSelectedItemName(null);
      }
    } else if (selectedItemName && onDropObject) {
      onDropObject(activeSection, selectedItemName);
    }
  };

  const handleDesign = () => {
    if (activeSection === 'table' && selectedSchema) {
      onDesignTable(selectedSchema.name);
    } else if (activeSection === 'query' && selectedItemName) {
      const q = savedQueries.find(x => x.name === selectedItemName);
      if (q) {
        onOpenQuery ? onOpenQuery(q.name, q.sql) : onOpenSqlDefinition?.(q.name, q.sql);
      }
    } else if (activeSection === 'model') {
      onOpenModel?.();
    } else if (activeSection === 'charts') {
      onOpenChart?.();
    } else if (activeSection === 'backup') {
      onOpenBackup?.();
    } else if (activeSection === 'user') {
      onOpenUserManager?.();
    } else if (selectedItemName && onOpenSqlDefinition) {
      const targetView = views.find(v => v.name === selectedItemName);
      const targetProc = procedures.find(p => p.name === selectedItemName);
      const targetFunc = functions.find(f => f.name === selectedItemName);
      const targetTrg = triggers.find(t => t.name === selectedItemName);
      const sql = targetView?.definitionSql || targetProc?.definitionSql || targetFunc?.definitionSql || targetTrg?.statement || '';
      onOpenSqlDefinition(`${selectedItemName} [Design]`, sql);
    }
  };

  return (
    <div className="studio-object-explorer">
      {/* Sub-Action Toolbar (Object Actions Toolbar) */}
      <div className="object-explorer-subbar">
        <div className="subbar-actions-left">
          <button className="subbar-btn" title="New Folder">
            <FolderPlus size={15} />
          </button>
          <button 
            className="subbar-btn" 
            title="Design Selected Object"
            onClick={handleDesign}
            disabled={activeSection === 'table' ? !selectedSchema : !selectedItemName}
          >
            <PenTool size={14} />
          </button>
          <button 
            className="subbar-btn btn-plus-green" 
            title={`New ${activeSection.toUpperCase()}`}
            onClick={handleNew}
          >
            <PlusCircle size={15} />
          </button>
          <button 
            className="subbar-btn btn-minus-red" 
            title={`Delete ${activeSection.toUpperCase()}`}
            onClick={handleDelete}
            disabled={activeSection === 'table' ? !selectedSchema : !selectedItemName}
          >
            <MinusCircle size={15} />
          </button>
          
          <div className="subbar-separator"></div>

          <button className="subbar-btn" title="Undo">
            <Undo2 size={14} />
          </button>
          <button className="subbar-btn" title="Redo">
            <Redo2 size={14} />
          </button>
          <button 
            className="subbar-btn" 
            title="Refresh All Objects"
            onClick={onRefreshSchemas}
          >
            <RefreshCw size={14} />
          </button>

          <div className="subbar-separator"></div>

          {/* View Toggles */}
          <button 
            className={`subbar-btn ${viewMode === 'list' ? 'active-view' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={15} />
          </button>
          <button 
            className={`subbar-btn ${viewMode === 'grid' ? 'active-view' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Tile View"
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        {/* Search Input Right */}
        <div className="subbar-search-right">
          <div className="subbar-search-box">
            <Search size={13} className="search-icon" />
            <input 
              type="text" 
              placeholder={`Search ${activeSection}s...`}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="subbar-search-input"
            />
            {searchFilter && (
              <button className="search-clear-btn" onClick={() => setSearchFilter('')}>×</button>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="object-explorer-canvas">
        {/* 1. TABLE SECTION */}
        {activeSection === 'table' && (
          viewMode === 'list' ? (
            <div className="studio-object-table-wrapper">
              <table className="studio-object-table">
                <thead>
                  <tr>
                    <th className="th-col-name">Name</th>
                    <th className="th-col-rows">Rows</th>
                    <th className="th-col-size">Data Length</th>
                    <th className="th-col-engine">Engine</th>
                    <th className="th-col-collation">Collation</th>
                    <th className="th-col-modified">Modified Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchemas.map((schema) => {
                    const isSelected = selectedSchema?.name === schema.name;
                    const rowCount = schema.rowCount ?? 0;
                    const estimatedSize = schema.dataLength || `${Math.max(4, rowCount * 4)} KB`;

                    return (
                      <tr 
                        key={schema.name}
                        className={`object-row ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => {
                          onSelectSchema(schema);
                          setSelectedItemName(schema.name);
                        }}
                        onDoubleClick={() => onOpenTableData(schema.name)}
                      >
                        <td className="td-name">
                          <TableIcon size={14} className="obj-icon-table" />
                          <span className="obj-name-text">{schema.name}</span>
                        </td>
                        <td className="td-rows">{rowCount.toLocaleString()}</td>
                        <td className="td-size">{estimatedSize}</td>
                        <td className="td-engine">{schema.engine || 'InnoDB / WASM'}</td>
                        <td className="td-collation">{schema.collation || 'utf8mb4_unicode_ci'}</td>
                        <td className="td-modified">{schema.modifiedDate || '2026-10-21 08:00'}</td>
                      </tr>
                    );
                  })}
                  {filteredSchemas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-objects-cell">
                        No tables found in this connection
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="studio-object-grid-wrapper">
              {filteredSchemas.map((schema) => {
                const isSelected = selectedSchema?.name === schema.name;
                return (
                  <div 
                    key={schema.name}
                    className={`object-grid-card ${isSelected ? 'card-selected' : ''}`}
                    onClick={() => {
                      onSelectSchema(schema);
                      setSelectedItemName(schema.name);
                    }}
                    onDoubleClick={() => onOpenTableData(schema.name)}
                  >
                    <div className="card-icon-wrapper">
                      <TableIcon size={32} className="card-table-icon" />
                    </div>
                    <span className="card-name" title={schema.name}>{schema.name}</span>
                    <span className="card-meta">{(schema.rowCount ?? 0).toLocaleString()} rows</span>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* 2. VIEW SECTION */}
        {activeSection === 'view' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">View Name</th>
                  <th className="th-col-type">Type</th>
                  <th className="th-col-status">Security</th>
                  <th className="th-col-check">Check Option</th>
                  <th className="th-col-modified">Modified Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredViews.map(view => {
                  const isSelected = selectedItemName === view.name;
                  return (
                    <tr 
                      key={view.name}
                      className={`object-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => setSelectedItemName(view.name)}
                      onDoubleClick={() => (onOpenViewData ? onOpenViewData(view.name) : onOpenTableData(view.name))}
                    >
                      <td className="td-name">
                        <Eye size={14} className="obj-icon-view" />
                        <span className="obj-name-text">{view.name}</span>
                      </td>
                      <td className="td-type">VIEW</td>
                      <td className="td-status">{view.security || 'DEFINER'}</td>
                      <td className="td-check">{view.checkOption || 'NONE'}</td>
                      <td className="td-modified">{view.modifiedDate || '2026-10-21 08:00'}</td>
                    </tr>
                  );
                })}
                {filteredViews.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-objects-cell">
                      No views found in this database. Click ➕ above to create a new View.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. PROCEDURE SECTION (Stored Procedures) */}
        {activeSection === 'procedure' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Procedure Name</th>
                  <th className="th-col-params">Parameters / Signature</th>
                  <th className="th-col-type">Type</th>
                  <th className="th-col-status">Security</th>
                  <th className="th-col-modified">Modified Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map(proc => {
                  const isSelected = selectedItemName === proc.name;
                  return (
                    <tr 
                      key={proc.name}
                      className={`object-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => setSelectedItemName(proc.name)}
                      onDoubleClick={() => onOpenSqlDefinition?.(proc.name, proc.definitionSql)}
                    >
                      <td className="td-name">
                        <Workflow size={14} className="leaf-proc-icon" />
                        <span className="obj-name-text">{proc.name}</span>
                      </td>
                      <td className="td-params">{proc.params || '()'}</td>
                      <td className="td-type">PROCEDURE</td>
                      <td className="td-status">{proc.security || 'DEFINER'}</td>
                      <td className="td-modified">{proc.modifiedDate || '2026-10-21 08:00'}</td>
                    </tr>
                  );
                })}
                {filteredProcedures.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-objects-cell">
                      No stored procedures found in this database. Click ➕ to create a Procedure.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. FUNCTION SECTION */}
        {activeSection === 'function' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Function Name</th>
                  <th className="th-col-params">Parameters</th>
                  <th className="th-col-return">Return Type</th>
                  <th className="th-col-type">Type</th>
                  <th className="th-col-modified">Modified Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredFunctions.map(func => {
                  const isSelected = selectedItemName === func.name;
                  return (
                    <tr 
                      key={func.name}
                      className={`object-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => setSelectedItemName(func.name)}
                      onDoubleClick={() => onOpenSqlDefinition?.(func.name, func.definitionSql)}
                    >
                      <td className="td-name">
                        <span className="leaf-fx-icon">ƒ</span>
                        <span className="obj-name-text">{func.name}</span>
                      </td>
                      <td className="td-params">{func.params || '()'}</td>
                      <td className="td-return">{func.returnType}</td>
                      <td className="td-type">FUNCTION</td>
                      <td className="td-modified">{func.modifiedDate || '2026-10-21 08:00'}</td>
                    </tr>
                  );
                })}
                {filteredFunctions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-objects-cell">
                      No functions found in this database. Click ➕ to create a Function.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. TRIGGER SECTION */}
        {activeSection === 'trigger' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Trigger Name</th>
                  <th className="th-col-table">Target Table</th>
                  <th className="th-col-timing">Timing</th>
                  <th className="th-col-event">Event</th>
                  <th className="th-col-modified">Modified Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTriggers.map(trg => {
                  const isSelected = selectedItemName === trg.name;
                  return (
                    <tr 
                      key={trg.name}
                      className={`object-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => setSelectedItemName(trg.name)}
                      onDoubleClick={() => onOpenSqlDefinition?.(trg.name, trg.statement)}
                    >
                      <td className="td-name">
                        <Zap size={14} className="leaf-trigger-icon" />
                        <span className="obj-name-text">{trg.name}</span>
                      </td>
                      <td className="td-table">{trg.tableName}</td>
                      <td className="td-timing">{trg.timing}</td>
                      <td className="td-event">{trg.event}</td>
                      <td className="td-modified">{trg.modifiedDate || '2026-10-21 08:00'}</td>
                    </tr>
                  );
                })}
                {filteredTriggers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-objects-cell">
                      No triggers found in this database. Click ➕ to create a Trigger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. QUERY SECTION */}
        {activeSection === 'query' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Query Name</th>
                  <th className="th-col-modified">Last Executed</th>
                  <th style={{ padding: '6px 12px' }}>SQL Statement Preview</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueries.map(q => {
                  const isSelected = selectedItemName === q.name;
                  return (
                    <tr 
                      key={q.id} 
                      className={`object-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => setSelectedItemName(q.name)}
                      onDoubleClick={() => onOpenQuery ? onOpenQuery(q.name, q.sql) : onOpenSqlDefinition?.(q.name, q.sql)}
                    >
                      <td className="td-name">
                        <div className="studio-binary-icon" style={{ display: 'inline-flex', marginRight: '8px' }}>
                          <span>01</span>
                          <span>10</span>
                        </div>
                        <span className="obj-name-text">{q.name}</span>
                      </td>
                      <td className="td-modified">{q.lastRun}</td>
                      <td style={{ color: '#8c919b', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                        {q.sql}
                      </td>
                    </tr>
                  );
                })}
                {filteredQueries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-objects-cell">
                      No saved queries found. Click ➕ or New Query to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. AUTOMATION SECTION */}
        {activeSection === 'automation' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Task / Job Name</th>
                  <th style={{ padding: '6px 12px' }}>Schedule</th>
                  <th style={{ padding: '6px 12px' }}>Target Database</th>
                  <th style={{ padding: '6px 12px' }}>Status</th>
                  <th className="th-col-modified">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {automationTasks.map(task => {
                  const isSelected = selectedItemName === task.name;
                  return (
                    <tr 
                      key={task.id}
                      className={`object-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => setSelectedItemName(task.name)}
                      onDoubleClick={() => alert(`Automation task: "${task.name}" (${task.schedule})`)}
                    >
                      <td className="td-name">
                        <Bot size={14} style={{ color: '#52c41a', marginRight: '8px' }} />
                        <span className="obj-name-text">{task.name}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}>{task.schedule}</td>
                      <td>{activeConnectionName}</td>
                      <td>
                        <span style={{ 
                          background: task.status === 'Active' ? 'rgba(82, 196, 26, 0.2)' : 'rgba(255, 255, 255, 0.1)', 
                          color: task.status === 'Active' ? '#52c41a' : '#8c919b',
                          padding: '2px 8px', 
                          borderRadius: '10px', 
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {task.status}
                        </span>
                      </td>
                      <td className="td-modified">{task.lastRun}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. USER SECTION */}
        {activeSection === 'user' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">User Account</th>
                  <th style={{ padding: '6px 12px' }}>Host</th>
                  <th style={{ padding: '6px 12px' }}>Global Privileges</th>
                  <th className="th-col-modified">Account Status</th>
                </tr>
              </thead>
              <tbody>
                {dbUsers.map(u => {
                  const isSelected = selectedItemName === u.name;
                  return (
                    <tr 
                      key={u.name}
                      className={`object-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => setSelectedItemName(u.name)}
                      onDoubleClick={() => onOpenUserManager?.()}
                    >
                      <td className="td-name">
                        <User size={14} style={{ color: '#faad14', marginRight: '8px' }} />
                        <span className="obj-name-text">{u.name}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}>{u.host}</td>
                      <td style={{ fontSize: '11px', color: '#c4c4cb' }}>{u.privileges}</td>
                      <td style={{ color: '#52c41a', fontSize: '11px' }}>Open / Active</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 9. MODEL SECTION */}
        {activeSection === 'model' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Model Name</th>
                  <th className="th-col-type">Diagram Type</th>
                  <th style={{ padding: '6px 12px' }}>Database</th>
                  <th className="th-col-modified">Modified Date</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  className={`object-row ${selectedItemName === 'Physical ER Model' ? 'row-selected' : ''}`}
                  onClick={() => setSelectedItemName('Physical ER Model')}
                  onDoubleClick={() => onOpenModel?.()}
                >
                  <td className="td-name">
                    <Share2 size={14} className="obj-icon-model" style={{ marginRight: '8px' }} />
                    <span className="obj-name-text">Relational Schema Physical ER Model</span>
                  </td>
                  <td className="td-type">Crow's Foot Relational</td>
                  <td>{activeConnectionName}</td>
                  <td className="td-modified">Today at 08:05</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 10. CHARTS SECTION */}
        {activeSection === 'charts' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Dashboard Name</th>
                  <th className="th-col-type">Visuals</th>
                  <th style={{ padding: '6px 12px' }}>Target Table</th>
                  <th className="th-col-modified">Modified Date</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  className={`object-row ${selectedItemName === 'Revenue Analytics' ? 'row-selected' : ''}`}
                  onClick={() => setSelectedItemName('Revenue Analytics')}
                  onDoubleClick={() => onOpenChart?.()}
                >
                  <td className="td-name">
                    <BarChart3 size={14} className="obj-icon-charts" style={{ marginRight: '8px' }} />
                    <span className="obj-name-text">Monthly Revenue & Performance Analytics</span>
                  </td>
                  <td className="td-type">Bar / Line / Donut</td>
                  <td>{schemas[0]?.name || 'Current Schema'}</td>
                  <td className="td-modified">Today at 08:05</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 11. BACKUP SECTION */}
        {activeSection === 'backup' && (
          <div className="studio-object-table-wrapper">
            <table className="studio-object-table">
              <thead>
                <tr>
                  <th className="th-col-name">Backup File</th>
                  <th className="th-col-size">Size</th>
                  <th style={{ padding: '6px 12px' }}>Target Database</th>
                  <th className="th-col-modified">Created Date</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  className={`object-row ${selectedItemName === 'database_snapshot.sql' ? 'row-selected' : ''}`}
                  onClick={() => setSelectedItemName('database_snapshot.sql')}
                  onDoubleClick={() => onOpenBackup?.()}
                >
                  <td className="td-name">
                    <RotateCcw size={14} className="obj-icon-backup" style={{ marginRight: '8px' }} />
                    <span className="obj-name-text">{activeConnectionName}_snapshot_20261023.sql</span>
                  </td>
                  <td className="td-size">148.5 KB</td>
                  <td>{activeConnectionName}</td>
                  <td className="td-modified">Today at 08:00</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
