import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Terminal, 
  Table as TableIcon, 
  Share2, 
  PenTool, 
  BarChart3, 
  HardDrive,
  GitCompare,
  Code,
  Activity,
  ShieldCheck,
  Archive,
  BookOpen,
  Code2
} from 'lucide-react';
import { StudioToolbar, type StudioSection } from './components/StudioToolbar';
import { DbSidebar } from './components/DbSidebar';
import { ObjectExplorer } from './components/ObjectExplorer';
import { ObjectInspector } from './components/ObjectInspector';
import { DataGrid } from './components/DataGrid';
import { QueryEditor } from './components/QueryEditor';
import { ERDiagram } from './components/ERDiagram';
import { TableDesigner } from './components/TableDesigner';
import { ChartsVisualizer } from './components/ChartsVisualizer';
import { StructureSync } from './components/StructureSync';
import { VisualQueryBuilder } from './components/VisualQueryBuilder';
import { ServerMonitor } from './components/ServerMonitor';
import { UserManager } from './components/UserManager';
import { BackupRestore } from './components/BackupRestore';
import { DataDictionary } from './components/DataDictionary';
import { SnippetManager } from './components/SnippetManager';
import { ConnectionModal } from './components/ConnectionModal';
import { DataGeneratorModal } from './components/DataGeneratorModal';
import { ExportImportModal } from './components/ExportImportModal';
import { CrossPlatformInfoModal } from './components/CrossPlatformInfoModal';
import { dbEngine } from './services/dbEngine';
import { dbGateway } from './services/dbGateway';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { DatabaseConnection, DatabaseEngine, DatabaseObjects, TableSchema, WorkspaceTab } from './types/database';

const STORAGE_KEY_CONNECTIONS = 'nexabase_saved_connections';
const LEGACY_STORAGE_KEY_CONNECTIONS = 'dmtools_saved_connections';

function getInitialConnections(): DatabaseConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONNECTIONS) || localStorage.getItem(LEGACY_STORAGE_KEY_CONNECTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Keep ONLY connections explicitly added by user (exclude former hardcoded demo IDs)
        const userConnections = parsed.filter(c => 
          c && c.id && 
          !c.id.startsWith('conn-demo-') &&
          c.id !== 'conn-sample-sqlite' &&
          c.id !== 'conn-db-berpadu' &&
          c.id !== 'conn-db-termos' &&
          c.id !== 'conn-db-termos-ecourt' &&
          c.id !== 'conn-e-payment' &&
          c.id !== 'conn-pnbp-prod' &&
          c.id !== 'conn-local-coba-8889' &&
          c.id !== 'conn-siap-prod' &&
          c.id !== 'conn-perpus-dev' &&
          c.id !== 'conn-local-postgres'
        );
        localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(userConnections));
        return userConnections;
      }
    }
  } catch (e) {
    console.error('Failed to load saved connections from localStorage', e);
  }
  return [];
}



export const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [connections, setConnections] = useState<DatabaseConnection[]>(getInitialConnections);
  const [activeConnectionId, setActiveConnectionId] = useState<string>(() => {
    const conns = getInitialConnections();
    return conns[0]?.id || '';
  });
  const [databaseObjects, setDatabaseObjects] = useState<DatabaseObjects>({
    tables: [],
    views: [],
    procedures: [],
    functions: [],
    triggers: [],
  });
  const [schemas, setSchemas] = useState<TableSchema[]>([]);
  const [objectsByConnId, setObjectsByConnId] = useState<Record<string, DatabaseObjects>>({});
  const [loadingConnIds, setLoadingConnIds] = useState<Record<string, boolean>>({});
  const [selectedSchema, setSelectedSchema] = useState<TableSchema | null>(null);
  const [connModalEngine, setConnModalEngine] = useState<DatabaseEngine | undefined>(undefined);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);

  // Studio Toolbar Active Section
  const [activeSection, setActiveSection] = useState<StudioSection>('table');

  // Layout View Toggles (matching top right Studio icons)
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  // Workspace Tabs (starts with clean Objects viewer)
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    {
      id: 'tab-objects',
      title: 'Objects',
      type: 'data-grid',
      connectionId: '',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-objects');

  // Modals
  const [showConnModal, setShowConnModal] = useState(false);
  const [showDataGenModal, setShowDataGenModal] = useState(false);
  const [showExportImportModal, setShowExportImportModal] = useState(false);
  const [showCrossPlatformModal, setShowCrossPlatformModal] = useState(false);

  const activeConnIdRef = useRef(activeConnectionId);
  activeConnIdRef.current = activeConnectionId;

  // Whenever activeConnectionId changes or objectsByConnId updates, sync databaseObjects and schemas
  useEffect(() => {
    const currentObjs = objectsByConnId[activeConnectionId];
    if (currentObjs) {
      setDatabaseObjects(currentObjs);
      setSchemas(currentObjs.tables || []);
    }
  }, [activeConnectionId, objectsByConnId]);

  const refreshDatabaseObjects = async (connId: string, currentConns = connections) => {
    const conn = currentConns.find(c => c.id === connId);
    if (!conn) {
      return;
    }

    setLoadingConnIds(prev => ({ ...prev, [connId]: true }));
    try {
      const objects = await dbGateway.getDatabaseObjects(conn);
      setObjectsByConnId(prev => ({ ...prev, [connId]: objects }));
      if (connId === activeConnIdRef.current) {
        setDatabaseObjects(objects);
        setSchemas(objects.tables || []);
      }
    } catch (e) {
      console.error(`Failed to load database objects for ${connId}:`, e);
    } finally {
      setLoadingConnIds(prev => ({ ...prev, [connId]: false }));
    }
  };

  const ensureObjectsLoaded = (connId: string, currentConns = connections) => {
    if (!objectsByConnId[connId] && !loadingConnIds[connId]) {
      refreshDatabaseObjects(connId, currentConns);
    }
  };

  const refreshSchemas = (connId: string = activeConnectionId, currentConns = connections) => {
    return refreshDatabaseObjects(connId, currentConns);
  };

  // Initialize DB Engine on mount
  useEffect(() => {
    const init = async () => {
      try {
        await dbEngine.initialize();
        const initialConns = getInitialConnections();
        initialConns.forEach(c => {
          if (c.engine === 'sqlite') {
            try {
              dbEngine.createDatabase(c.id, c.name);
            } catch (e) {
              console.error('Error re-initializing sqlite DB', e);
            }
          }
        });

        if (activeConnectionId) {
          await refreshDatabaseObjects(activeConnectionId, initialConns);
        } else if (initialConns.length > 0) {
          await refreshDatabaseObjects(initialConns[0].id, initialConns);
        } else {
          setDatabaseObjects({ tables: [], views: [], procedures: [], functions: [], triggers: [] });
          setSchemas([]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  const handleSelectConnection = (connId: string) => {
    setActiveConnectionId(connId);
    setSelectedSchema(null);
    if (objectsByConnId[connId]) {
      setDatabaseObjects(objectsByConnId[connId]);
      setSchemas(objectsByConnId[connId].tables || []);
    } else {
      setDatabaseObjects({ tables: [], views: [], procedures: [], functions: [], triggers: [] });
      setSchemas([]);
      refreshDatabaseObjects(connId);
    }
  };

  const activeConnection = connections.find(c => c.id === activeConnectionId) || null;

  // Tab operations
  const openTab = (newTab: Omit<WorkspaceTab, 'id'>) => {
    const existing = tabs.find(t => 
      t.type === newTab.type && 
      t.connectionId === newTab.connectionId && 
      (newTab.tableName ? t.tableName === newTab.tableName : true)
    );

    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const id = `tab-${Date.now()}`;
    const fullTab: WorkspaceTab = { ...newTab, id };
    setTabs(prev => [...prev, fullTab]);
    setActiveTabId(id);
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabId === 'tab-objects') return; // Cannot close Objects tab
    const filtered = tabs.filter(t => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  const handleOpenTable = (tableName: string, connId?: string) => {
    const targetConnId = connId || activeConnectionId;
    if (targetConnId !== activeConnectionId) {
      handleSelectConnection(targetConnId);
    }
    const targetConn = connections.find(c => c.id === targetConnId);
    const connLabel = targetConn ? targetConn.name : 'Localhost';
    openTab({
      title: `${tableName} [${connLabel}]`,
      type: 'data-grid',
      connectionId: targetConnId,
      tableName,
      initialViewMode: 'grid',
    });
  };

  const handleDesignTable = (tableName: string, connId?: string) => {
    const targetConnId = connId || activeConnectionId;
    if (targetConnId !== activeConnectionId) {
      handleSelectConnection(targetConnId);
    }
    openTab({
      title: `${tableName} [Structure]`,
      type: 'table-designer',
      connectionId: targetConnId,
      tableName,
    });
  };

  const handleNewQuery = (initialSql?: string, connId?: string) => {
    const targetConnId = connId || activeConnectionId;
    const defaultSql = initialSql || 'SELECT * FROM products LIMIT 10;';
    const queryNum = tabs.filter(t => t.type === 'query-editor').length + 1;
    openTab({
      title: `Query ${queryNum}`,
      type: 'query-editor',
      connectionId: targetConnId,
      querySql: defaultSql,
    });
  };

  const handleSaveConnection = (newConn: DatabaseConnection) => {
    // If it's a SQLite database, initialize live SQLite instance
    if (newConn.engine === 'sqlite') {
      try {
        dbEngine.createDatabase(newConn.id, newConn.name);
      } catch (e) {
        console.error('Failed to initialize SQLite database for new connection', e);
      }
    }

    const exists = connections.some(c => c.id === newConn.id);
    const updatedConns = exists 
      ? connections.map(c => c.id === newConn.id ? newConn : c)
      : [...connections, newConn];

    setConnections(updatedConns);
    try {
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(updatedConns));
    } catch (e) {
      console.error('Failed to save connections to localStorage', e);
    }

    setActiveConnectionId(newConn.id);
    refreshDatabaseObjects(newConn.id, updatedConns);
  };

  const handleDeleteConnection = (connId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const connToDelete = connections.find(c => c.id === connId);
    if (!connToDelete) return;

    if (!confirm(`Are you sure you want to remove connection "${connToDelete.name}"?`)) {
      return;
    }

    const updatedConns = connections.filter(c => c.id !== connId);
    setConnections(updatedConns);
    try {
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(updatedConns));
    } catch (err) {
      console.error('Failed to update connections in localStorage', err);
    }

    if (activeConnectionId === connId) {
      const nextId = updatedConns[0]?.id || '';
      setActiveConnectionId(nextId);
      if (nextId) {
        refreshDatabaseObjects(nextId, updatedConns);
      } else {
        setDatabaseObjects({ tables: [], views: [], procedures: [], functions: [], triggers: [] });
        setSchemas([]);
        setSelectedSchema(null);
      }
    }
  };

  const handleToggleConnectionState = (conn: DatabaseConnection) => {
    const updatedConns = connections.map(c => {
      if (c.id === conn.id) {
        return { ...c, isClosed: !c.isClosed };
      }
      return c;
    });
    setConnections(updatedConns);
    try {
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(updatedConns));
    } catch (e) {
      console.error('Failed to save connection state', e);
    }
    if (conn.isClosed) {
      refreshDatabaseObjects(conn.id, updatedConns);
    }
  };

  const handleEditConnection = (conn: DatabaseConnection) => {
    setEditingConnection(conn);
    setConnModalEngine(conn.engine);
    setShowConnModal(true);
  };

  const handleDuplicateConnection = (conn: DatabaseConnection) => {
    const duplicated: DatabaseConnection = {
      ...conn,
      id: `conn-${Date.now()}`,
      name: `${conn.name} Copy`,
    };
    handleSaveConnection(duplicated);
  };

  const handleSetConnectionColor = (connId: string, color?: string) => {
    const updatedConns = connections.map(c => {
      if (c.id === connId) {
        return { ...c, colorTag: color || undefined };
      }
      return c;
    });
    setConnections(updatedConns);
    try {
      localStorage.setItem(STORAGE_KEY_CONNECTIONS, JSON.stringify(updatedConns));
    } catch (e) {
      console.error('Failed to update connection color in localStorage', e);
    }
  };

  const handleNewDatabase = (conn: DatabaseConnection) => {
    const dbName = prompt('Enter new database name:');
    if (!dbName || !dbName.trim()) return;
    const trimmed = dbName.trim();
    if (conn.engine === 'sqlite') {
      alert(`Database file "${trimmed}.db" initialized.`);
    } else {
      handleNewQuery(`CREATE DATABASE \`${trimmed}\`;`, conn.id);
    }
  };

  const handleDeleteDatabase = (conn: DatabaseConnection, dbName: string) => {
    if (confirm(`Are you sure you want to drop database "${dbName}"?`)) {
      handleNewQuery(`DROP DATABASE \`${dbName}\`;`, conn.id);
    }
  };

  const handleTruncateTable = async (tableName: string, connId: string) => {
    if (!confirm(`Are you sure you want to truncate table "${tableName}"? All records will be wiped.`)) return;
    const conn = connections.find(c => c.id === connId);
    if (conn?.engine === 'sqlite') {
      try {
        await dbEngine.execute(connId, `DELETE FROM "${tableName}";`);
        refreshSchemas(connId);
        alert(`Table "${tableName}" truncated.`);
      } catch (e: any) {
        alert(`Truncate error: ${e?.message}`);
      }
    } else if (conn) {
      try {
        await dbGateway.executeQuery(conn, `TRUNCATE TABLE \`${tableName}\`;`);
        refreshSchemas(connId);
        alert(`Table "${tableName}" truncated.`);
      } catch (e: any) {
        alert(`Truncate error: ${e?.message}`);
      }
    }
  };

  const handleDuplicateTable = async (tableName: string, connId: string) => {
    const newTableName = prompt(`Enter new name for duplicate of "${tableName}":`, `${tableName}_copy`);
    if (!newTableName || !newTableName.trim()) return;
    const targetName = newTableName.trim();
    const conn = connections.find(c => c.id === connId);
    if (conn?.engine === 'sqlite') {
      try {
        await dbEngine.execute(connId, `CREATE TABLE "${targetName}" AS SELECT * FROM "${tableName}";`);
        refreshSchemas(connId);
        alert(`Table duplicated as "${targetName}".`);
      } catch (e: any) {
        alert(`Duplicate table error: ${e?.message}`);
      }
    } else if (conn) {
      handleNewQuery(`CREATE TABLE \`${targetName}\` LIKE \`${tableName}\`;\nINSERT INTO \`${targetName}\` SELECT * FROM \`${tableName}\`;`, connId);
    }
  };

  const handleDeleteTable = async (tableName: string, connId: string) => {
    if (!confirm(`Are you sure you want to drop table "${tableName}"?`)) return;
    const conn = connections.find(c => c.id === connId);
    if (conn?.engine === 'sqlite') {
      try {
        await dbEngine.execute(connId, `DROP TABLE "${tableName}";`);
        refreshSchemas(connId);
      } catch (e: any) {
        alert(`Drop table error: ${e?.message}`);
      }
    } else if (conn) {
      try {
        await dbGateway.executeQuery(conn, `DROP TABLE \`${tableName}\`;`);
        refreshSchemas(connId);
      } catch (e: any) {
        alert(`Drop table error: ${e?.message}`);
      }
    }
  };

  const handleDeleteView = (viewName: string, connId: string) => {
    if (!confirm(`Are you sure you want to drop view "${viewName}"?`)) return;
    handleNewQuery(`DROP VIEW IF EXISTS \`${viewName}\`;`, connId);
  };

  const handleDeleteRoutine = (section: 'procedure' | 'function', name: string, connId: string) => {
    if (!confirm(`Are you sure you want to drop ${section} "${name}"?`)) return;
    handleNewQuery(`DROP ${section.toUpperCase()} IF EXISTS \`${name}\`;`, connId);
  };

  const handleExecuteSqlFile = (conn: DatabaseConnection) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sql';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          const sql = re.target?.result as string;
          handleNewQuery(sql, conn.id);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleDumpSqlFile = async (conn: DatabaseConnection, type: 'all' | 'structure', tableName?: string) => {
    const connObjs = objectsByConnId[conn.id] || databaseObjects;
    const targetTables = tableName ? (connObjs.tables?.filter(t => t.name === tableName) || []) : (connObjs.tables || []);
    let dumpText = `-- Universal Database Studio Dump\n-- Connection: ${conn.name} (${conn.engine})\n-- Dump Type: ${type}\n-- Generated at: ${new Date().toISOString()}\n\n`;
    for (const t of targetTables) {
      dumpText += `-- Table structure for table "${t.name}"\n`;
      dumpText += `CREATE TABLE IF NOT EXISTS "${t.name}" (\n`;
      const colDefs = t.columns.map(c => `  "${c.name}" ${c.type}${c.primaryKey ? ' PRIMARY KEY' : ''}${c.notNull ? ' NOT NULL' : ''}`);
      dumpText += colDefs.join(',\n') + '\n);\n\n';
    }
    const blob = new Blob([dumpText], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conn.name.replace(/\s+/g, '_')}_${tableName || 'dump'}_${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToolbarSectionChange = (section: StudioSection) => {
    setActiveSection(section);
    setActiveTabId('tab-objects');
  };

  const handleSelectTab = (tab: WorkspaceTab) => {
    setActiveTabId(tab.id);
    if (tab.type === 'data-grid' || tab.type === 'table-designer') {
      setActiveSection('table');
    } else if (tab.type === 'query-editor') {
      setActiveSection('query');
    } else if (tab.type === 'er-diagram') {
      setActiveSection('model');
    } else if (tab.type === 'charts') {
      setActiveSection('charts');
    } else if (tab.type === 'user-manager') {
      setActiveSection('user');
    } else if (tab.type === 'backup-restore') {
      setActiveSection('backup');
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const activeTabConnection = connections.find(c => c.id === activeTab?.connectionId) || activeConnection;
  const activeTableSchema = (activeTab?.connectionId && objectsByConnId[activeTab.connectionId]?.tables?.find(s => s.name === activeTab?.tableName))
    || schemas.find(s => s.name === activeTab?.tableName)
    || null;

  const activeTableName = activeTab?.tableName;
  const activeTableConnId = activeTab?.connectionId;

  const openTableKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const t of tabs) {
      if (t.tableName && t.connectionId) {
        keys.add(`${t.connectionId}:${t.tableName}`);
      }
    }
    return keys;
  }, [tabs]);

  if (isInitializing) {
    return (
      <div className="studio-splash-screen">
        <div className="splash-center">
          <div className="splash-icon-pulse">
            <img src="/nexabase_logo.png" alt="Nexabase Studio" className="splash-app-icon" />
          </div>
          <h2>Nexabase Studio</h2>
          <p>Initializing SQLite WebAssembly Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-application-root">
      {/* 1. Studio Window Titlebar & Toolbar */}
      <StudioToolbar
        activeSection={activeSection}
        onSelectSection={handleToolbarSectionChange}
        activeConnection={activeConnection}
        onOpenNewConnection={(engine) => {
          setConnModalEngine(engine);
          setShowConnModal(true);
        }}
        onOpenNewQuery={() => handleNewQuery()}
        onOpenStructureSync={() => openTab({ title: 'Structure Sync', type: 'structure-sync', connectionId: activeConnectionId })}
        onOpenServerMonitor={() => openTab({ title: 'Server Monitor', type: 'server-monitor', connectionId: activeConnectionId })}
        onOpenDataDictionary={() => openTab({ title: 'Data Dictionary', type: 'data-dictionary', connectionId: activeConnectionId })}
        onOpenSnippetManager={() => openTab({ title: 'SQL Snippets', type: 'snippet-manager', connectionId: activeConnectionId })}
        onOpenDataGenerator={() => setShowDataGenModal(true)}
        onOpenExportImport={() => setShowExportImportModal(true)}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        showInspector={showInspector}
        onToggleInspector={() => setShowInspector(!showInspector)}
      />

      {/* 2. Main 3-Pane Layout (Sidebar | Workspace | Inspector) */}
      <div className="studio-body-layout">
        {/* Left Pane: Connections Explorer */}
        {showSidebar && (
          <DbSidebar
            connections={connections}
            activeConnectionId={activeConnectionId}
            onSelectConnection={handleSelectConnection}
            activeTableName={activeTableName}
            activeTableConnId={activeTableConnId}
            openTableKeys={openTableKeys}
            selectedTableName={selectedSchema?.name}
            schemas={schemas}
            views={databaseObjects.views}
            procedures={databaseObjects.procedures}
            functions={databaseObjects.functions}
            triggers={databaseObjects.triggers}
            objectsByConnId={objectsByConnId}
            loadingConnIds={loadingConnIds}
            onEnsureObjectsLoaded={ensureObjectsLoaded}
            onOpenTable={handleOpenTable}
            onOpenView={(viewName, connId) => {
              const targetConnId = connId || activeConnectionId;
              const targetObjects = objectsByConnId[targetConnId] || databaseObjects;
              const v = targetObjects.views?.find(x => x.name === viewName);
              handleNewQuery(v?.definitionSql || `SELECT * FROM ${viewName} LIMIT 100;`, targetConnId);
            }}
            onOpenRoutine={(routineName, sql, connId) => {
              handleNewQuery(sql || `-- Stored Routine: ${routineName}\n`, connId);
            }}
            onOpenTrigger={(triggerName, sql, connId) => {
              handleNewQuery(sql || `-- Trigger: ${triggerName}\n`, connId);
            }}
            onSelectTableForInspector={(schema, connId) => {
              if (connId && connId !== activeConnectionId) {
                handleSelectConnection(connId);
              }
              setSelectedSchema(schema);
            }}
            onOpenNewConnection={(engine) => {
              setConnModalEngine(engine);
              setEditingConnection(null);
              setShowConnModal(true);
            }}
            onDeleteConnection={handleDeleteConnection}
            onToggleConnectionState={handleToggleConnectionState}
            onEditConnection={handleEditConnection}
            onDuplicateConnection={handleDuplicateConnection}
            onSetConnectionColor={handleSetConnectionColor}
            onRefreshConnection={(connId) => refreshSchemas(connId)}
            onNewQuery={(connId, sql) => handleNewQuery(sql, connId)}
            onOpenConsole={(connId) => handleNewQuery('-- SQL Console\n', connId)}
            onExecuteSqlFile={handleExecuteSqlFile}
            onDumpSqlFile={handleDumpSqlFile}
            onNewDatabase={handleNewDatabase}
            onDeleteDatabase={handleDeleteDatabase}
            onReverseToModel={(connId) => openTab({ title: 'Schema Model (ER)', type: 'er-diagram', connectionId: connId })}
            onDesignTable={(tableName, connId) => handleDesignTable(tableName, connId)}
            onNewTable={(connId) => openTab({ title: 'New Table', type: 'table-designer', connectionId: connId || activeConnectionId, tableName: 'new_table' })}
            onDeleteTable={handleDeleteTable}
            onTruncateTable={handleTruncateTable}
            onDuplicateTable={handleDuplicateTable}
            onDesignView={(viewName, connId) => {
              const targetObjs = objectsByConnId[connId] || databaseObjects;
              const v = targetObjs.views?.find(x => x.name === viewName);
              handleNewQuery(v?.definitionSql || `SELECT * FROM ${viewName};`, connId);
            }}
            onNewView={(connId) => handleNewQuery(`CREATE VIEW v_new_view AS\nSELECT * FROM ${schemas[0]?.name || 'table_name'};\n`, connId)}
            onDeleteView={handleDeleteView}
            onNewRoutine={(section, connId) => handleNewQuery(section === 'procedure' ? `CREATE PROCEDURE sp_new_procedure()\nBEGIN\n  -- logic\nEND;\n` : `CREATE FUNCTION fn_new_function()\nRETURNS INT\nBEGIN\n  RETURN 1;\nEND;\n`, connId)}
            onExecuteRoutine={(routineName, connId) => handleNewQuery(`CALL \`${routineName}\`();`, connId)}
            onDeleteRoutine={handleDeleteRoutine}
            onOpenImportWizard={() => setShowExportImportModal(true)}
            onOpenExportWizard={() => setShowExportImportModal(true)}
            onOpenDataGenerator={() => setShowDataGenModal(true)}
            onCreateChart={(connId) => openTab({ title: 'Analytics & Charts', type: 'charts', connectionId: connId || activeConnectionId })}
          />
        )}

        {/* Center Pane: Tabbed Document Workspace */}
        <main className="studio-middle-workspace">
          {/* Document Tab Bar */}
          <div className="studio-tabs-bar">
            {/* Active Connection Breadcrumb Badge */}
            <div 
              className="studio-tabs-conn-badge" 
              title={`Active Connection: ${activeConnection?.name || 'Localhost'}`}
              onClick={() => {
                setActiveSection('table');
                setActiveTabId('tab-objects');
              }}
            >
              <span className="conn-badge-dot" />
              <span>{activeConnection?.name || 'Localhost'}</span>
            </div>

            <div className="studio-tabs-scroll">
              {tabs.map(tab => {
                const isActive = tab.id === activeTabId;
                const isObjects = tab.id === 'tab-objects';

                return (
                  <div
                    key={tab.id}
                    className={`studio-tab-item ${isActive ? 'active' : ''} ${isObjects ? 'objects-tab' : ''}`}
                    onClick={() => handleSelectTab(tab)}
                  >
                    {!isObjects && (
                      <span className="tab-type-indicator">
                        {tab.type === 'data-grid' && <TableIcon size={12} className="tab-icon-blue" />}
                        {tab.type === 'query-editor' && <Terminal size={12} className="tab-icon-gray" />}
                        {tab.type === 'er-diagram' && <Share2 size={12} className="tab-icon-orange" />}
                        {tab.type === 'table-designer' && <PenTool size={12} className="tab-icon-amber" />}
                        {tab.type === 'charts' && <BarChart3 size={12} className="tab-icon-purple" />}
                        {tab.type === 'structure-sync' && <GitCompare size={12} className="tab-icon-blue" />}
                        {tab.type === 'query-builder' && <Code size={12} className="tab-icon-gray" />}
                        {tab.type === 'server-monitor' && <Activity size={12} className="tab-icon-red" />}
                        {tab.type === 'user-manager' && <ShieldCheck size={12} className="tab-icon-green" />}
                        {tab.type === 'backup-restore' && <Archive size={12} className="tab-icon-amber" />}
                        {tab.type === 'data-dictionary' && <BookOpen size={12} className="tab-icon-purple" />}
                        {tab.type === 'snippet-manager' && <Code2 size={12} className="tab-icon-blue" />}
                      </span>
                    )}

                    <span className="studio-tab-title">{tab.title}</span>

                    {!isObjects && (
                      <button 
                        className="studio-tab-close" 
                        onClick={(e) => closeTab(tab.id, e)}
                        title="Close Tab"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              className="studio-new-tab-btn" 
              onClick={() => handleNewQuery()}
              title="New Query Tab"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Active Content Body */}
          <div className="studio-tab-viewport">
            {activeTab.id === 'tab-objects' ? (
              <ObjectExplorer
                activeSection={activeSection}
                schemas={schemas}
                views={databaseObjects.views}
                procedures={databaseObjects.procedures}
                functions={databaseObjects.functions}
                triggers={databaseObjects.triggers}
                selectedSchema={selectedSchema}
                onSelectSchema={(schema) => setSelectedSchema(schema)}
                onOpenTableData={handleOpenTable}
                onOpenViewData={(viewName) => {
                  const v = databaseObjects.views.find(x => x.name === viewName);
                  handleNewQuery(v?.definitionSql || `SELECT * FROM ${viewName} LIMIT 100;`);
                }}
                onDesignTable={handleDesignTable}
                onOpenSqlDefinition={(title, sql) => {
                  handleNewQuery(sql || `-- Definition for ${title}\n`);
                }}
                onNewTable={() => openTab({ title: 'New Table', type: 'table-designer', connectionId: activeConnectionId, tableName: 'new_table' })}
                onNewObject={(section) => {
                  if (section === 'view') {
                    handleNewQuery(`CREATE VIEW v_custom_view AS\nSELECT * FROM ${schemas[0]?.name || 'table_name'};\n`);
                  } else if (section === 'procedure') {
                    handleNewQuery(`-- Create Stored Procedure\nCREATE PROCEDURE sp_custom_action()\nLANGUAGE SQL\nAS $$\n  -- procedure logic here\n$$;\n`);
                  } else if (section === 'function') {
                    handleNewQuery(`-- Create Function\nCREATE FUNCTION fn_custom_compute(param1 INT)\nRETURNS INT\nLANGUAGE SQL\nAS $$\n  SELECT param1 * 2;\n$$;\n`);
                  } else if (section === 'trigger') {
                    handleNewQuery(`-- Create Trigger\nCREATE TRIGGER trg_custom_audit\nAFTER UPDATE ON ${schemas[0]?.name || 'table_name'}\nFOR EACH ROW\nEXECUTE FUNCTION trg_log_function();\n`);
                  } else {
                    openTab({ title: 'New Table', type: 'table-designer', connectionId: activeConnectionId, tableName: 'new_table' });
                  }
                }}
                onDropTable={(tableName) => {
                  if (confirm(`Drop table "${tableName}"?`)) {
                    if (activeConnection?.engine === 'sqlite') {
                      dbEngine.execute(activeConnectionId, `DROP TABLE "${tableName}";`);
                    } else if (activeConnection) {
                      dbGateway.executeQuery(activeConnection, `DROP TABLE "${tableName}";`);
                    }
                    refreshDatabaseObjects(activeConnectionId);
                    setSelectedSchema(null);
                  }
                }}
                onDropObject={(section, name) => {
                  if (confirm(`Are you sure you want to drop ${section} "${name}"?`)) {
                    const dropSql = section === 'view' ? `DROP VIEW "${name}";`
                      : section === 'procedure' ? `DROP PROCEDURE "${name}";`
                      : section === 'function' ? `DROP FUNCTION "${name}";`
                      : section === 'trigger' ? `DROP TRIGGER "${name}";`
                      : `DROP TABLE "${name}";`;
                    if (activeConnection?.engine === 'sqlite') {
                      try { dbEngine.execute(activeConnectionId, dropSql); } catch (e) {}
                    } else if (activeConnection) {
                      dbGateway.executeQuery(activeConnection, dropSql).catch(() => {});
                    }
                    refreshDatabaseObjects(activeConnectionId);
                  }
                }}
                onRefreshSchemas={() => refreshDatabaseObjects(activeConnectionId)}
                onOpenNewQuery={() => handleNewQuery()}
                onOpenQuery={(_title, sql) => handleNewQuery(sql)}
                onOpenModel={() => openTab({ title: 'Schema Model (ER)', type: 'er-diagram', connectionId: activeConnectionId })}
                onOpenChart={() => openTab({ title: 'Analytics & Charts', type: 'charts', connectionId: activeConnectionId })}
                onOpenBackup={() => openTab({ title: 'Backup / Restore', type: 'backup-restore', connectionId: activeConnectionId })}
                onOpenUserManager={() => openTab({ title: 'User & Roles', type: 'user-manager', connectionId: activeConnectionId })}
                activeConnectionName={activeConnection?.name || 'Localhost'}
              />
            ) : (
              <ErrorBoundary
                key={activeTab.id}
                fallbackTitle={`Failed to load "${activeTab.title}"`}
                onReset={() => refreshSchemas(activeTab.connectionId)}
              >
                {activeTab.type === 'data-grid' && activeTab.tableName && (
                  <DataGrid
                    key={activeTab.id}
                    connectionId={activeTab.connectionId}
                    tableName={activeTab.tableName}
                    schema={activeTableSchema}
                    activeConnection={activeTabConnection}
                    initialViewMode={activeTab.initialViewMode}
                    onRefreshSchema={() => refreshSchemas(activeTab.connectionId)}
                  />
                )}

                {activeTab.type === 'query-editor' && (
                  <QueryEditor
                    key={activeTab.id}
                    connectionId={activeTab.connectionId}
                    activeConnection={activeTabConnection}
                    initialSql={activeTab.querySql}
                    onRefreshSchemas={() => refreshSchemas(activeTab.connectionId)}
                  />
                )}

                {activeTab.type === 'er-diagram' && (
                  <ERDiagram
                    schemas={schemas}
                    onOpenTable={handleOpenTable}
                    onDesignTable={handleDesignTable}
                  />
                )}

                {activeTab.type === 'table-designer' && (
                  <TableDesigner
                    connectionId={activeTab.connectionId}
                    tableName={activeTab.tableName || 'new_table'}
                    initialSchema={activeTableSchema}
                    onSaved={() => {
                      refreshSchemas(activeTab.connectionId);
                      closeTab(activeTab.id);
                    }}
                  />
                )}

                {activeTab.type === 'charts' && (
                  <ChartsVisualizer
                    schemas={schemas}
                    connectionId={activeTab.connectionId}
                  />
                )}

                {activeTab.type === 'structure-sync' && (
                  <StructureSync
                    connections={connections}
                    activeConnectionId={activeConnectionId}
                    sourceSchemas={schemas}
                    onRefreshSchemas={() => refreshSchemas(activeConnectionId)}
                    onOpenInQueryEditor={(sql: string) => handleNewQuery(sql)}
                  />
                )}

                {activeTab.type === 'query-builder' && (
                  <VisualQueryBuilder
                    schemas={schemas}
                    onExecuteQuery={(sql) => handleNewQuery(sql)}
                  />
                )}

                {activeTab.type === 'server-monitor' && (
                  <ServerMonitor
                    connectionId={activeConnectionId}
                  />
                )}

                {activeTab.type === 'user-manager' && (
                  <UserManager />
                )}

                {activeTab.type === 'backup-restore' && (
                  <BackupRestore
                    connectionId={activeConnectionId}
                    onRefreshSchemas={() => refreshSchemas(activeConnectionId)}
                  />
                )}

                {activeTab.type === 'data-dictionary' && (
                  <DataDictionary
                    databaseName={activeConnection?.database || 'Database'}
                    schemas={schemas}
                  />
                )}

                {activeTab.type === 'snippet-manager' && (
                  <SnippetManager
                    onInsertToQuery={(sql: string) => handleNewQuery(sql)}
                  />
                )}
              </ErrorBoundary>
            )}
          </div>
        </main>

        {/* Right Pane: Object Information Inspector */}
        {showInspector && (
          <ObjectInspector
            selectedSchema={selectedSchema}
            activeConnectionName={activeConnection?.name || 'Local Database'}
            onOpenTableData={handleOpenTable}
            onDesignTable={handleDesignTable}
            onNewQuery={(sql) => handleNewQuery(sql)}
          />
        )}
      </div>

      {/* Studio Status Bar (Bottom) */}
      <footer className="studio-status-bar">
        <div className="status-item">
          <HardDrive size={12} className="status-icon" />
          <span>Connected: <strong>{activeConnection ? activeConnection.name : 'No Active Connection'}</strong></span>
        </div>
        <div className="status-item">
          <span>Engine: <strong>{activeConnection?.engine ? activeConnection.engine.toUpperCase() : '-'}</strong></span>
        </div>
        <div className="status-item">
          <span>Objects: <strong>{activeConnection ? `${schemas.length} Tables • ${databaseObjects.views?.length || 0} Views • ${(databaseObjects.procedures?.length || 0) + (databaseObjects.functions?.length || 0)} Routines • ${databaseObjects.triggers?.length || 0} Triggers` : '0 Objects'}</strong></span>
        </div>
        <div className="status-right-item">
          <button 
            className="cross-platform-link-btn" 
            onClick={() => setShowCrossPlatformModal(true)}
            title="Cross Platform Information"
          >
            Universal: macOS • Windows • Linux
          </button>
        </div>
      </footer>

      {/* Modals */}
      <ConnectionModal
        isOpen={showConnModal}
        onClose={() => {
          setShowConnModal(false);
          setEditingConnection(null);
        }}
        onSave={handleSaveConnection}
        initialEngine={connModalEngine}
        initialConnection={editingConnection}
      />

      <DataGeneratorModal
        isOpen={showDataGenModal}
        onClose={() => setShowDataGenModal(false)}
        connectionId={activeConnectionId}
        schemas={schemas}
        onDataGenerated={() => refreshSchemas(activeConnectionId)}
      />

      <ExportImportModal
        isOpen={showExportImportModal}
        onClose={() => setShowExportImportModal(false)}
        connectionId={activeConnectionId}
        schemas={schemas}
        onDataImported={() => refreshSchemas(activeConnectionId)}
      />

      <CrossPlatformInfoModal
        isOpen={showCrossPlatformModal}
        onClose={() => setShowCrossPlatformModal(false)}
      />
    </div>
  );
};

export default App;
