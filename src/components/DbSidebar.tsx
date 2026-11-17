import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Table as TableIcon, 
  Eye, 
  Binary, 
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Trash2,
  Workflow,
  Zap
} from 'lucide-react';
import type { 
  DatabaseConnection, 
  DatabaseEngine,
  DatabaseObjects,
  TableSchema, 
  ViewDefinition, 
  ProcedureDefinition, 
  FunctionDefinition, 
  TriggerDefinition 
} from '../types/database';
import { SidebarContextMenu, type SidebarContextMenuState } from './SidebarContextMenu';

interface DbSidebarProps {
  connections: DatabaseConnection[];
  activeConnectionId: string;
  onSelectConnection: (connId: string) => void;
  schemas: TableSchema[];
  views?: ViewDefinition[];
  procedures?: ProcedureDefinition[];
  functions?: FunctionDefinition[];
  triggers?: TriggerDefinition[];
  objectsByConnId?: Record<string, DatabaseObjects>;
  loadingConnIds?: Record<string, boolean>;
  onEnsureObjectsLoaded?: (connId: string) => void;
  onOpenTable: (tableName: string, connId?: string) => void;
  onOpenView?: (viewName: string, connId?: string) => void;
  onOpenRoutine?: (name: string, sql?: string, connId?: string) => void;
  onOpenTrigger?: (name: string, sql?: string, connId?: string) => void;
  onSelectTableForInspector?: (schema: TableSchema, connId?: string) => void;
  onOpenNewConnection: (engine?: DatabaseEngine) => void;
  onDeleteConnection?: (connId: string, e?: React.MouseEvent) => void;
  // Context Menu Handlers
  onToggleConnectionState?: (conn: DatabaseConnection) => void;
  onEditConnection?: (conn: DatabaseConnection) => void;
  onDuplicateConnection?: (conn: DatabaseConnection) => void;
  onSetConnectionColor?: (connId: string, color?: string) => void;
  onRefreshConnection?: (connId: string) => void;
  onNewQuery?: (connId: string, sql?: string) => void;
  onOpenConsole?: (connId: string) => void;
  onExecuteSqlFile?: (conn: DatabaseConnection) => void;
  onDumpSqlFile?: (conn: DatabaseConnection, type: 'all' | 'structure', tableName?: string) => void;
  onNewDatabase?: (conn: DatabaseConnection) => void;
  onDeleteDatabase?: (conn: DatabaseConnection, dbName: string) => void;
  onReverseToModel?: (connId: string) => void;
  onDesignTable?: (tableName: string, connId: string) => void;
  onNewTable?: (connId: string) => void;
  onDeleteTable?: (tableName: string, connId: string) => void;
  onTruncateTable?: (tableName: string, connId: string) => void;
  onDuplicateTable?: (tableName: string, connId: string) => void;
  onDesignView?: (viewName: string, connId: string) => void;
  onNewView?: (connId: string) => void;
  onDeleteView?: (viewName: string, connId: string) => void;
  onNewRoutine?: (section: 'procedure' | 'function', connId: string) => void;
  onExecuteRoutine?: (name: string, connId: string) => void;
  onDeleteRoutine?: (section: 'procedure' | 'function', name: string, connId: string) => void;
  onOpenImportWizard?: (connId: string, tableName?: string) => void;
  onOpenExportWizard?: (connId: string, tableName?: string) => void;
  onOpenDataGenerator?: (connId: string, tableName?: string) => void;
  onCreateChart?: (connId: string, tableName?: string) => void;
  // Active/Open Table Indicators
  activeTableName?: string;
  activeTableConnId?: string;
  openTableKeys?: Set<string>;
  selectedTableName?: string;
}

export const DbSidebar: React.FC<DbSidebarProps> = ({
  connections,
  activeConnectionId,
  onSelectConnection,
  schemas,
  views = [],
  procedures = [],
  functions = [],
  triggers = [],
  objectsByConnId = {},
  loadingConnIds = {},
  onEnsureObjectsLoaded,
  onOpenTable,
  onOpenView,
  onOpenRoutine,
  onOpenTrigger,
  onSelectTableForInspector,
  onOpenNewConnection,
  onDeleteConnection,
  onToggleConnectionState,
  onEditConnection,
  onDuplicateConnection,
  onSetConnectionColor,
  onRefreshConnection,
  onNewQuery,
  onOpenConsole,
  onExecuteSqlFile,
  onDumpSqlFile,
  onNewDatabase,
  onDeleteDatabase,
  onReverseToModel,
  onDesignTable,
  onNewTable,
  onDeleteTable,
  onTruncateTable,
  onDuplicateTable,
  onDesignView,
  onNewView,
  onDeleteView,
  onNewRoutine,
  onExecuteRoutine,
  onDeleteRoutine,
  onOpenImportWizard,
  onOpenExportWizard,
  onOpenDataGenerator,
  onCreateChart,
  activeTableName,
  activeTableConnId,
  openTableKeys,
  selectedTableName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedConns, setExpandedConns] = useState<Record<string, boolean>>({
    [activeConnectionId]: true,
  });
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState | null>(null);

  // Ensure active connection is auto-expanded whenever switched
  useEffect(() => {
    setExpandedConns(prev => ({
      ...prev,
      [activeConnectionId]: true,
    }));
  }, [activeConnectionId]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleConnection = (connId: string) => {
    const nextState = !expandedConns[connId];
    setExpandedConns(prev => ({
      ...prev,
      [connId]: nextState,
    }));
    onSelectConnection(connId);
    if (nextState && onEnsureObjectsLoaded) {
      onEnsureObjectsLoaded(connId);
    }
  };

  const isSectionExpanded = (connId: string, section: string) => {
    const key = `${connId}:${section}`;
    if (expandedSections[key] !== undefined) {
      return expandedSections[key];
    }
    return section === 'tables';
  };

  const toggleSection = (connId: string, section: string) => {
    const key = `${connId}:${section}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !isSectionExpanded(connId, section),
    }));
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    menuProps: Omit<SidebarContextMenuState, 'isOpen' | 'x' | 'y'>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      ...menuProps,
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const filteredConnections = connections.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="studio-sidebar-pane">
      {/* Connections Tree List */}
      <div className="studio-connections-scroll">
        {filteredConnections.map(conn => {
          const isSelected = conn.id === activeConnectionId;
          const isExpanded = !!expandedConns[conn.id];
          const isConnLoading = !!loadingConnIds[conn.id];
          const connObjects = objectsByConnId[conn.id] || (isSelected ? { tables: schemas, views, procedures, functions, triggers } : undefined);
          const connTables = (connObjects?.tables || []).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
          const connViews = (connObjects?.views || []).filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()));
          const connProcedures = (connObjects?.procedures || []).filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
          const connFunctions = (connObjects?.functions || []).filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
          const connTriggers = (connObjects?.triggers || []).filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

          return (
            <div key={conn.id} className="studio-conn-item-wrapper">
              <div 
                className={`studio-conn-row ${isSelected ? 'selected' : ''} ${conn.isClosed ? 'is-closed' : ''}`}
                onClick={() => {
                  if (conn.isClosed && onToggleConnectionState) {
                    onToggleConnectionState(conn);
                  }
                  toggleConnection(conn.id);
                }}
                onContextMenu={(e) => handleContextMenu(e, {
                  type: 'connection',
                  conn,
                  databaseName: conn.database,
                })}
              >
                <span className="conn-expand-chevron">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <div className="conn-engine-icon" style={{ opacity: conn.isClosed ? 0.45 : 1 }}>
                  <Database size={15} className={`engine-${conn.engine}`} />
                  {isSelected && !conn.isClosed && <span className="conn-active-badge"></span>}
                </div>
                <span className="conn-title-text" title={conn.name} style={{ opacity: conn.isClosed ? 0.6 : 1 }}>
                  {conn.name}
                </span>
                {conn.colorTag && (
                  <span 
                    className="conn-color-tag-dot" 
                    style={{ backgroundColor: conn.colorTag }} 
                    title={`Color: ${conn.colorTag}`} 
                  />
                )}
                {conn.isClosed && (
                  <span className="conn-closed-tag" title="Closed connection" style={{ fontSize: '10px', color: '#777', fontStyle: 'italic', marginLeft: 'auto', paddingRight: '4px' }}>
                    closed
                  </span>
                )}
                {onDeleteConnection && (
                  <button 
                    className="conn-delete-mini-btn" 
                    onClick={(e) => onDeleteConnection(conn.id, e)}
                    title="Remove Connection"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>

              {/* Expanded Connection Objects */}
              {isExpanded && !conn.isClosed && (
                <div className="studio-conn-children">
                  {isConnLoading && (
                    <div style={{ padding: '6px 12px 6px 28px', color: '#888', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RotateCcw size={12} className="spin-animate" />
                      <span>Loading database objects...</span>
                    </div>
                  )}

                  {!isConnLoading && !connObjects && (
                    <div 
                      style={{ padding: '6px 12px 6px 28px', color: '#777', fontSize: '11px', cursor: 'pointer' }}
                      onClick={() => onEnsureObjectsLoaded?.(conn.id)}
                    >
                      (Click to inspect objects)
                    </div>
                  )}

                  {!isConnLoading && connObjects && (
                    <>
                      {/* 1. Tables Group */}
                      <div className="studio-sub-group">
                        <div 
                          className="studio-sub-row"
                          onClick={() => toggleSection(conn.id, 'tables')}
                          onContextMenu={(e) => handleContextMenu(e, {
                            type: 'group',
                            conn,
                            group: 'tables',
                            databaseName: conn.database,
                          })}
                        >
                          <span className="group-expand-chevron">
                            {isSectionExpanded(conn.id, 'tables') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <TableIcon size={13} className="sub-group-icon table-clr" />
                          <span className="sub-group-title">Tables</span>
                          <span className="sub-group-count">{connObjects.tables?.length || 0}</span>
                        </div>

                        {isSectionExpanded(conn.id, 'tables') && (
                          <div className="studio-table-list">
                            {connTables.map(schema => {
                              const isTableActive = conn.id === activeTableConnId && schema.name === activeTableName;
                              const isTableOpen = openTableKeys?.has(`${conn.id}:${schema.name}`);
                              const isTableSelected = schema.name === selectedTableName && conn.id === activeConnectionId;

                              return (
                                <div 
                                  key={schema.name}
                                  className={`studio-table-leaf ${isTableActive ? 'is-active' : ''} ${isTableOpen && !isTableActive ? 'is-open' : ''} ${isTableSelected && !isTableActive ? 'is-selected' : ''}`}
                                  onClick={() => {
                                    if (conn.id !== activeConnectionId) onSelectConnection(conn.id);
                                    onSelectTableForInspector?.(schema, conn.id);
                                  }}
                                  onDoubleClick={() => {
                                    if (conn.id !== activeConnectionId) onSelectConnection(conn.id);
                                    onOpenTable(schema.name, conn.id);
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, {
                                    type: 'table-leaf',
                                    conn,
                                    itemName: schema.name,
                                    itemSchema: schema,
                                    databaseName: conn.database,
                                  })}
                                >
                                  <TableIcon size={12} className="leaf-table-icon" />
                                  <span className="leaf-name" title={schema.name}>{schema.name}</span>
                                  {isTableActive && (
                                    <span className="leaf-active-tag" title="Currently active table">
                                      <span className="leaf-active-dot" />
                                      Active
                                    </span>
                                  )}
                                  {isTableOpen && !isTableActive && (
                                    <span className="leaf-open-dot" title="Open in workspace tab" />
                                  )}
                                  <span className="leaf-badge">{schema.rowCount ?? 0}</span>
                                </div>
                              );
                            })}
                            {connTables.length === 0 && (
                              <div className="empty-sub-leaf">(No tables)</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Views Group */}
                      <div className="studio-sub-group">
                        <div 
                          className="studio-sub-row"
                          onClick={() => toggleSection(conn.id, 'views')}
                          onContextMenu={(e) => handleContextMenu(e, {
                            type: 'group',
                            conn,
                            group: 'views',
                            databaseName: conn.database,
                          })}
                        >
                          <span className="group-expand-chevron">
                            {isSectionExpanded(conn.id, 'views') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <Eye size={13} className="sub-group-icon view-clr" />
                          <span className="sub-group-title">Views</span>
                          <span className="sub-group-count">{connObjects.views?.length || 0}</span>
                        </div>

                        {isSectionExpanded(conn.id, 'views') && (
                          <div className="studio-table-list">
                            {connViews.map(view => {
                              const isViewActive = conn.id === activeTableConnId && view.name === activeTableName;
                              const isViewOpen = openTableKeys?.has(`${conn.id}:${view.name}`);

                              return (
                                <div 
                                  key={view.name}
                                  className={`studio-table-leaf ${isViewActive ? 'is-active' : ''} ${isViewOpen && !isViewActive ? 'is-open' : ''}`}
                                  onDoubleClick={() => {
                                    if (conn.id !== activeConnectionId) onSelectConnection(conn.id);
                                    if (onOpenView) onOpenView(view.name, conn.id);
                                    else onOpenTable(view.name, conn.id);
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, {
                                    type: 'view-leaf',
                                    conn,
                                    itemName: view.name,
                                    databaseName: conn.database,
                                  })}
                                >
                                  <Eye size={12} className="leaf-view-icon" />
                                  <span className="leaf-name" title={view.name}>{view.name}</span>
                                  {isViewActive && (
                                    <span className="leaf-active-tag" title="Currently active view">
                                      <span className="leaf-active-dot" />
                                      Active
                                    </span>
                                  )}
                                  {isViewOpen && !isViewActive && (
                                    <span className="leaf-open-dot" title="Open in workspace tab" />
                                  )}
                                </div>
                              );
                            })}
                            {connViews.length === 0 && (
                              <div className="empty-sub-leaf">(No views)</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 3. Procedures Group (Stored Procedures) */}
                      <div className="studio-sub-group">
                        <div 
                          className="studio-sub-row"
                          onClick={() => toggleSection(conn.id, 'procedures')}
                          onContextMenu={(e) => handleContextMenu(e, {
                            type: 'group',
                            conn,
                            group: 'procedures',
                            databaseName: conn.database,
                          })}
                        >
                          <span className="group-expand-chevron">
                            {isSectionExpanded(conn.id, 'procedures') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <Workflow size={13} className="sub-group-icon proc-clr" />
                          <span className="sub-group-title">Procedures</span>
                          <span className="sub-group-count">{connObjects.procedures?.length || 0}</span>
                        </div>

                        {isSectionExpanded(conn.id, 'procedures') && (
                          <div className="studio-table-list">
                            {connProcedures.map(proc => (
                              <div 
                                key={proc.name}
                                className="studio-table-leaf"
                                onDoubleClick={() => {
                                  if (conn.id !== activeConnectionId) onSelectConnection(conn.id);
                                  onOpenRoutine?.(proc.name, proc.definitionSql, conn.id);
                                }}
                                onContextMenu={(e) => handleContextMenu(e, {
                                  type: 'routine-leaf',
                                  conn,
                                  itemName: proc.name,
                                  databaseName: conn.database,
                                })}
                              >
                                <Workflow size={12} className="leaf-proc-icon" />
                                <span className="leaf-name" title={proc.name}>{proc.name}</span>
                              </div>
                            ))}
                            {connProcedures.length === 0 && (
                              <div className="empty-sub-leaf">(No procedures)</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 4. Functions Group */}
                      <div className="studio-sub-group">
                        <div 
                          className="studio-sub-row"
                          onClick={() => toggleSection(conn.id, 'functions')}
                          onContextMenu={(e) => handleContextMenu(e, {
                            type: 'group',
                            conn,
                            group: 'functions',
                            databaseName: conn.database,
                          })}
                        >
                          <span className="group-expand-chevron">
                            {isSectionExpanded(conn.id, 'functions') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <span className="sub-fx-badge">ƒ(x)</span>
                          <span className="sub-group-title">Functions</span>
                          <span className="sub-group-count">{connObjects.functions?.length || 0}</span>
                        </div>

                        {isSectionExpanded(conn.id, 'functions') && (
                          <div className="studio-table-list">
                            {connFunctions.map(func => (
                              <div 
                                key={func.name}
                                className="studio-table-leaf"
                                onDoubleClick={() => {
                                  if (conn.id !== activeConnectionId) onSelectConnection(conn.id);
                                  onOpenRoutine?.(func.name, func.definitionSql, conn.id);
                                }}
                                onContextMenu={(e) => handleContextMenu(e, {
                                  type: 'routine-leaf',
                                  conn,
                                  itemName: func.name,
                                  databaseName: conn.database,
                                })}
                              >
                                <span className="leaf-fx-icon">ƒ</span>
                                <span className="leaf-name" title={func.name}>{func.name}</span>
                              </div>
                            ))}
                            {connFunctions.length === 0 && (
                              <div className="empty-sub-leaf">(No functions)</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 5. Triggers Group */}
                      <div className="studio-sub-group">
                        <div 
                          className="studio-sub-row"
                          onClick={() => toggleSection(conn.id, 'triggers')}
                          onContextMenu={(e) => handleContextMenu(e, {
                            type: 'group',
                            conn,
                            group: 'triggers',
                            databaseName: conn.database,
                          })}
                        >
                          <span className="group-expand-chevron">
                            {isSectionExpanded(conn.id, 'triggers') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <Zap size={13} className="sub-group-icon trigger-clr" />
                          <span className="sub-group-title">Triggers</span>
                          <span className="sub-group-count">{connObjects.triggers?.length || 0}</span>
                        </div>

                        {isSectionExpanded(conn.id, 'triggers') && (
                          <div className="studio-table-list">
                            {connTriggers.map(trg => (
                              <div 
                                key={trg.name}
                                className="studio-table-leaf"
                                onDoubleClick={() => {
                                  if (conn.id !== activeConnectionId) onSelectConnection(conn.id);
                                  onOpenTrigger?.(trg.name, trg.statement, conn.id);
                                }}
                              >
                                <Zap size={12} className="leaf-trigger-icon" />
                                <span className="leaf-name" title={`${trg.name} (${trg.tableName})`}>
                                  {trg.name}
                                </span>
                              </div>
                            ))}
                            {connTriggers.length === 0 && (
                              <div className="empty-sub-leaf">(No triggers)</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 6. Queries Group */}
                      <div className="studio-sub-group">
                        <div 
                          className="studio-sub-row"
                          onClick={() => toggleSection(conn.id, 'queries')}
                          onContextMenu={(e) => handleContextMenu(e, {
                            type: 'group',
                            conn,
                            group: 'queries',
                            databaseName: conn.database,
                          })}
                        >
                          <span className="group-expand-chevron">
                            {isSectionExpanded(conn.id, 'queries') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <Binary size={13} className="sub-group-icon query-clr" />
                          <span className="sub-group-title">Queries</span>
                          <span className="sub-group-count">1</span>
                        </div>
                      </div>

                      {/* 7. Backups Group */}
                      <div className="studio-sub-group">
                        <div 
                          className="studio-sub-row"
                          onClick={() => toggleSection(conn.id, 'backups')}
                          onContextMenu={(e) => handleContextMenu(e, {
                            type: 'group',
                            conn,
                            group: 'backups',
                            databaseName: conn.database,
                          })}
                        >
                          <span className="group-expand-chevron">
                            {isSectionExpanded(conn.id, 'backups') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <RotateCcw size={13} className="sub-group-icon backup-clr" />
                          <span className="sub-group-title">Backups</span>
                          <span className="sub-group-count">0</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredConnections.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#888' }}>
            <Database size={32} style={{ opacity: 0.3, margin: '0 auto 10px auto', display: 'block' }} />
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#aaa', marginBottom: '6px' }}>
              No Connections Found
            </div>
            <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4', marginBottom: '14px' }}>
              Add your database connection to start managing schemas, tables & data.
            </div>
            <button 
              className="sidebar-add-conn-btn" 
              onClick={() => onOpenNewConnection()}
              style={{ margin: '0 auto', display: 'inline-flex', padding: '6px 12px', width: 'auto', borderRadius: '4px', gap: '6px', fontSize: '11px', cursor: 'pointer' }}
            >
              <Plus size={13} />
              <span>New Connection</span>
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Footer with Add, Sort and Search */}
      <div className="studio-sidebar-footer">
        <button 
          className="sidebar-add-conn-btn" 
          onClick={() => onOpenNewConnection()}
          title="New Connection"
        >
          <Plus size={13} />
        </button>
        <button className="sidebar-sort-btn" title="Sort & Options">
          <SlidersHorizontal size={13} />
        </button>
        <div className="sidebar-search-box">
          <Search size={13} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </div>

      {/* macOS Dark Glassmorphism Context Menu */}
      <SidebarContextMenu
        menuState={contextMenu}
        onClose={() => setContextMenu(null)}
        onToggleConnectionState={onToggleConnectionState || (() => {})}
        onEditConnection={onEditConnection || (() => {})}
        onDeleteConnection={onDeleteConnection || (() => {})}
        onDuplicateConnection={onDuplicateConnection || (() => {})}
        onNewConnection={onOpenNewConnection}
        onSetConnectionColor={onSetConnectionColor || (() => {})}
        onRefreshConnection={onRefreshConnection || (() => {})}
        onNewQuery={onNewQuery || (() => {})}
        onOpenConsole={onOpenConsole || ((connId) => onNewQuery?.(connId, '-- Terminal Console\n'))}
        onExecuteSqlFile={onExecuteSqlFile || (() => {})}
        onDumpSqlFile={onDumpSqlFile || (() => {})}
        onNewDatabase={onNewDatabase || (() => {})}
        onDeleteDatabase={onDeleteDatabase || (() => {})}
        onReverseToModel={onReverseToModel || (() => {})}
        onOpenTable={onOpenTable}
        onDesignTable={onDesignTable || ((_tbl, _cid) => {})}
        onNewTable={onNewTable || ((_cid) => {})}
        onDeleteTable={onDeleteTable || ((_tbl, _cid) => {})}
        onTruncateTable={onTruncateTable || ((_tbl, _cid) => {})}
        onDuplicateTable={onDuplicateTable || ((_tbl, _cid) => {})}
        onOpenView={onOpenView || ((vw, cid) => onOpenTable(vw, cid))}
        onDesignView={onDesignView || ((_vw, _cid) => {})}
        onNewView={onNewView || ((_cid) => {})}
        onDeleteView={onDeleteView || ((_vw, _cid) => {})}
        onNewRoutine={onNewRoutine || (() => {})}
        onExecuteRoutine={onExecuteRoutine || (() => {})}
        onDeleteRoutine={onDeleteRoutine || (() => {})}
        onOpenImportWizard={onOpenImportWizard || (() => {})}
        onOpenExportWizard={onOpenExportWizard || (() => {})}
        onOpenDataGenerator={onOpenDataGenerator || (() => {})}
        onCreateChart={onCreateChart || (() => {})}
      />
    </aside>
  );
};
