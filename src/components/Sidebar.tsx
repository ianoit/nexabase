import React, { useState } from 'react';
import { 
  Database, 
  Table as TableIcon, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Plus, 
  Folder, 
  FolderOpen, 
  Eye, 
  Key, 
  Code, 
  FileUp, 
  RefreshCw,
  HardDrive
} from 'lucide-react';
import type { DatabaseConnection, TableSchema } from '../types/database';

interface SidebarProps {
  connections: DatabaseConnection[];
  activeConnectionId: string;
  onSelectConnection: (connId: string) => void;
  schemas: TableSchema[];
  onOpenTable: (tableName: string, viewMode?: 'grid' | 'form' | 'json' | 'hex') => void;
  onDesignTable: (tableName: string) => void;
  onNewQueryForTable: (tableName: string) => void;
  onOpenNewConnection: () => void;
  onOpenFileDatabase: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshSchemas: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  connections,
  activeConnectionId,
  onSelectConnection,
  schemas,
  onOpenTable,
  onDesignTable,
  onNewQueryForTable,
  onOpenNewConnection,
  onOpenFileDatabase,
  onRefreshSchemas,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedConns, setExpandedConns] = useState<Record<string, boolean>>({
    [activeConnectionId]: true,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tables: true,
    views: false,
    functions: false,
    indexes: false,
  });

  const toggleConn = (connId: string) => {
    setExpandedConns(prev => ({
      ...prev,
      [connId]: !prev[connId],
    }));
    onSelectConnection(connId);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const filteredSchemas = schemas.filter(s => 
    s.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <aside className="app-sidebar">
      {/* Top Search & Actions */}
      <div className="sidebar-header">
        <div className="search-bar">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Filter database objects..."
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="search-input"
          />
          {filterQuery && (
            <button className="clear-search-btn" onClick={() => setFilterQuery('')}>×</button>
          )}
        </div>
        <div className="sidebar-actions-row">
          <button 
            className="sidebar-mini-btn" 
            onClick={onOpenNewConnection}
            title="Create New Connection"
          >
            <Plus size={14} />
            <span>Connection</span>
          </button>
          
          <label className="sidebar-mini-btn file-upload-label" title="Open Local SQLite .db file">
            <FileUp size={14} />
            <span>Open DB</span>
            <input 
              type="file" 
              accept=".sqlite,.db,.sqlite3" 
              onChange={onOpenFileDatabase} 
              style={{ display: 'none' }}
            />
          </label>

          <button 
            className="sidebar-mini-btn icon-only" 
            onClick={onRefreshSchemas}
            title="Refresh Object Tree"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="sidebar-tree-container">
        {connections.map(conn => {
          const isExpanded = Boolean(expandedConns[conn.id]);
          const isActive = conn.id === activeConnectionId;

          return (
            <div key={conn.id} className={`conn-tree-node ${isActive ? 'active' : ''}`}>
              <div 
                className="conn-tree-header"
                onClick={() => toggleConn(conn.id)}
              >
                <span className="expand-chevron">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <Database size={15} className={`engine-icon engine-${conn.engine}`} />
                <span className="conn-title" title={conn.name}>
                  {conn.name}
                </span>
                <span className={`engine-badge-pill ${conn.engine}`}>
                  {conn.engine}
                </span>
              </div>

              {/* Connection Children */}
              {isExpanded && (
                <div className="conn-children-container">
                  {/* Tables Section */}
                  <div className="object-group">
                    <div 
                      className="object-group-header"
                      onClick={() => toggleSection('tables')}
                    >
                      <span className="group-chevron">
                        {expandedSections.tables ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      {expandedSections.tables ? <FolderOpen size={13} className="folder-icon" /> : <Folder size={13} className="folder-icon" />}
                      <span className="group-title">Tables</span>
                      <span className="group-count-badge">{filteredSchemas.length}</span>
                    </div>

                    {expandedSections.tables && (
                      <div className="tables-list">
                        {filteredSchemas.length === 0 ? (
                          <div className="empty-tree-hint">No tables found</div>
                        ) : (
                          filteredSchemas.map(schema => (
                            <div 
                              key={schema.name}
                              className="table-tree-item"
                              onClick={() => onOpenTable(schema.name, 'grid')}
                              title={`Table: ${schema.name} (${schema.rowCount ?? 0} rows)`}
                            >
                              <TableIcon size={14} className="table-icon" />
                              <span className="table-item-name">{schema.name}</span>
                              
                              {schema.rowCount !== undefined && (
                                <span className="table-rows-tag">{schema.rowCount}</span>
                              )}

                              {/* Hover Quick Actions */}
                              <div className="item-hover-actions">
                                <button 
                                  className="action-chip"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDesignTable(schema.name);
                                  }}
                                  title="Design Table Structure"
                                >
                                  Design
                                </button>
                                <button 
                                  className="action-chip"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNewQueryForTable(schema.name);
                                  }}
                                  title="Write SQL Query for this table"
                                >
                                  Query
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Views Section */}
                  <div className="object-group">
                    <div 
                      className="object-group-header"
                      onClick={() => toggleSection('views')}
                    >
                      <span className="group-chevron">
                        {expandedSections.views ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      <Eye size={13} className="folder-icon" />
                      <span className="group-title">Views</span>
                      <span className="group-count-badge">2</span>
                    </div>
                    {expandedSections.views && (
                      <div className="tables-list sub-items">
                        <div className="table-tree-item dim" onClick={() => onNewQueryForTable('v_active_customers')}>
                          <Eye size={13} className="dim-icon" />
                          <span>v_active_customers</span>
                        </div>
                        <div className="table-tree-item dim" onClick={() => onNewQueryForTable('v_monthly_sales_summary')}>
                          <Eye size={13} className="dim-icon" />
                          <span>v_monthly_sales_summary</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Functions & Procedures Section */}
                  <div className="object-group">
                    <div 
                      className="object-group-header"
                      onClick={() => toggleSection('functions')}
                    >
                      <span className="group-chevron">
                        {expandedSections.functions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      <Code size={13} className="folder-icon" />
                      <span className="group-title">Functions & Triggers</span>
                      <span className="group-count-badge">3</span>
                    </div>
                    {expandedSections.functions && (
                      <div className="tables-list sub-items">
                        <div className="table-tree-item dim">
                          <Code size={13} className="dim-icon" />
                          <span>fn_calculate_loyalty()</span>
                        </div>
                        <div className="table-tree-item dim">
                          <Code size={13} className="dim-icon" />
                          <span>trg_update_inventory_timestamp</span>
                        </div>
                        <div className="table-tree-item dim">
                          <Code size={13} className="dim-icon" />
                          <span>trg_audit_order_changes</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Indexes Section */}
                  <div className="object-group">
                    <div 
                      className="object-group-header"
                      onClick={() => toggleSection('indexes')}
                    >
                      <span className="group-chevron">
                        {expandedSections.indexes ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      <Key size={13} className="folder-icon" />
                      <span className="group-title">Indexes</span>
                      <span className="group-count-badge">7</span>
                    </div>
                    {expandedSections.indexes && (
                      <div className="tables-list sub-items">
                        <div className="table-tree-item dim">
                          <Key size={13} className="dim-icon" />
                          <span>sqlite_autoindex_customers_1 (PK)</span>
                        </div>
                        <div className="table-tree-item dim">
                          <Key size={13} className="dim-icon" />
                          <span>sqlite_autoindex_products_1 (PK)</span>
                        </div>
                        <div className="table-tree-item dim">
                          <Key size={13} className="dim-icon" />
                          <span>idx_orders_customer_id</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer info */}
      <div className="sidebar-footer">
        <HardDrive size={13} className="storage-icon" />
        <span className="storage-info">SQLite WASM Engine • Local Sandbox</span>
      </div>
    </aside>
  );
};
