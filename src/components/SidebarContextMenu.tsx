import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  X
} from 'lucide-react';
import type { DatabaseConnection, DatabaseEngine, TableSchema } from '../types/database';

export type SidebarContextMenuType = 
  | 'connection' 
  | 'database' 
  | 'group' 
  | 'table-leaf' 
  | 'view-leaf' 
  | 'routine-leaf';

export interface SidebarContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: SidebarContextMenuType;
  conn: DatabaseConnection;
  group?: string; // 'tables' | 'views' | 'procedures' | 'functions' | 'triggers' | 'queries' | 'backups'
  databaseName?: string;
  itemName?: string;
  itemSchema?: TableSchema;
}

export interface SidebarContextMenuProps {
  menuState: SidebarContextMenuState | null;
  onClose: () => void;
  // Connection Actions
  onToggleConnectionState: (conn: DatabaseConnection) => void;
  onEditConnection: (conn: DatabaseConnection) => void;
  onDeleteConnection: (connId: string) => void;
  onDuplicateConnection: (conn: DatabaseConnection) => void;
  onNewConnection: (engine?: DatabaseEngine) => void;
  onSetConnectionColor: (connId: string, color?: string) => void;
  onRefreshConnection: (connId: string) => void;
  // Query & Console
  onNewQuery: (connId: string, sql?: string) => void;
  onOpenConsole: (connId: string) => void;
  onExecuteSqlFile: (conn: DatabaseConnection) => void;
  onDumpSqlFile: (conn: DatabaseConnection, type: 'all' | 'structure', tableName?: string) => void;
  // Database Actions
  onNewDatabase: (conn: DatabaseConnection) => void;
  onDeleteDatabase: (conn: DatabaseConnection, dbName: string) => void;
  onReverseToModel: (connId: string) => void;
  // Object Actions
  onOpenTable: (tableName: string, connId: string) => void;
  onDesignTable: (tableName: string, connId: string) => void;
  onNewTable: (connId: string) => void;
  onDeleteTable: (tableName: string, connId: string) => void;
  onTruncateTable: (tableName: string, connId: string) => void;
  onDuplicateTable: (tableName: string, connId: string) => void;
  onOpenView: (viewName: string, connId: string) => void;
  onDesignView: (viewName: string, connId: string) => void;
  onNewView: (connId: string) => void;
  onDeleteView: (viewName: string, connId: string) => void;
  onNewRoutine: (section: 'procedure' | 'function', connId: string) => void;
  onExecuteRoutine: (name: string, connId: string) => void;
  onDeleteRoutine: (section: 'procedure' | 'function', name: string, connId: string) => void;
  // Wizards & Tools
  onOpenImportWizard: (connId: string, tableName?: string) => void;
  onOpenExportWizard: (connId: string, tableName?: string) => void;
  onOpenDataGenerator: (connId: string, tableName?: string) => void;
  onCreateChart: (connId: string, tableName?: string) => void;
}

const COLOR_SWATCHES = [
  { label: 'None', color: '' },
  { label: 'Red', color: '#ff453a' },
  { label: 'Orange', color: '#ff9f0a' },
  { label: 'Yellow', color: '#ffd60a' },
  { label: 'Green', color: '#32d74b' },
  { label: 'Cyan', color: '#64d2ff' },
  { label: 'Purple', color: '#bf5af2' },
  { label: 'Gray', color: '#8e8e93' },
  { label: 'Crimson', color: '#ff375f' },
];

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({
  menuState,
  onClose,
  onToggleConnectionState,
  onEditConnection,
  onDeleteConnection,
  onDuplicateConnection,
  onNewConnection,
  onSetConnectionColor,
  onRefreshConnection,
  onNewQuery,
  onOpenConsole,
  onExecuteSqlFile,
  onDumpSqlFile,
  onNewDatabase,
  onDeleteDatabase,
  onReverseToModel,
  onOpenTable,
  onDesignTable,
  onNewTable,
  onDeleteTable,
  onTruncateTable,
  onDuplicateTable,
  onOpenView,
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
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!menuState?.isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuState?.isOpen, onClose]);

  if (!menuState || !menuState.isOpen) return null;

  const { x, y, type, conn, group, databaseName, itemName } = menuState;

  // Viewport edge collision adjustments
  const menuWidth = 240;
  const menuHeight = 440;
  const safeX = Math.min(x, window.innerWidth - menuWidth - 10);
  const safeY = Math.min(y, Math.max(10, window.innerHeight - menuHeight - 10));

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const isConnClosed = conn.isClosed;

  return (
    <div 
      ref={menuRef}
      className="studio-context-menu"
      style={{ left: `${safeX}px`, top: `${safeY}px` }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. CONNECTION CONTEXT MENU */}
      {type === 'connection' && (
        <>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onToggleConnectionState(conn))}
          >
            <span>{isConnClosed ? 'Open Connection' : 'Close Connection'}</span>
            <span className="studio-context-shortcut">⇧⌘.</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('conn-profiles')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Switch Connection Profile</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'conn-profiles' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => onRefreshConnection(conn.id))}>
                  <span>Default Profile</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onRefreshConnection(conn.id))}>
                  <span>Development Profile</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onRefreshConnection(conn.id))}>
                  <span>Production Read-Only</span>
                </div>
              </div>
            )}
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onEditConnection(conn))}
          >
            <span>Edit Connection...</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('new-conn-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>New Connection</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'new-conn-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => onNewConnection('mysql'))}>
                  <span>MySQL / MariaDB...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewConnection('postgres'))}>
                  <span>PostgreSQL...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewConnection('sqlite'))}>
                  <span>SQLite / Local File...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewConnection('mongodb'))}>
                  <span>MongoDB...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewConnection('redis'))}>
                  <span>Redis...</span>
                </div>
              </div>
            )}
          </div>

          <div 
            className="studio-context-item text-danger"
            onClick={() => handleAction(() => onDeleteConnection(conn.id))}
          >
            <span>Delete Connection</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onDuplicateConnection(conn))}
          >
            <span>Duplicate Connection...</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewDatabase(conn))}
          >
            <span>New Database...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewQuery(conn.id))}
          >
            <span>New Query</span>
            <span className="studio-context-shortcut">⌘Y</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenConsole(conn.id))}
          >
            <span>Console</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onExecuteSqlFile(conn))}
          >
            <span>Execute SQL File...</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('flush-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Flush</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'flush-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'FLUSH PRIVILEGES;'))}>
                  <span>Flush Privileges</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'FLUSH TABLES;'))}>
                  <span>Flush Tables</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'FLUSH LOGS;'))}>
                  <span>Flush Logs</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'FLUSH STATUS;'))}>
                  <span>Flush Status</span>
                </div>
              </div>
            )}
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('manage-group-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Manage Group</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'manage-group-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => alert('Create Connection Group'))}>
                  <span>New Group...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => alert('Move to Group'))}>
                  <span>Move to Group...</span>
                </div>
              </div>
            )}
          </div>

          {/* Color Swatch Picker */}
          <div className="studio-context-color-section">
            <span className="studio-context-color-label">Color:</span>
            <div className="studio-context-color-palette">
              {COLOR_SWATCHES.map((swatch, idx) => (
                <button
                  key={idx}
                  className={`color-swatch-dot ${!swatch.color ? 'clear-color' : ''} ${conn.colorTag === swatch.color ? 'active' : ''}`}
                  style={{ backgroundColor: swatch.color || 'transparent' }}
                  title={swatch.label}
                  onClick={() => handleAction(() => onSetConnectionColor(conn.id, swatch.color))}
                >
                  {!swatch.color && <X size={10} />}
                </button>
              ))}
            </div>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}

      {/* 2. DATABASE CONTEXT MENU */}
      {type === 'database' && (
        <>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onToggleConnectionState(conn))}
          >
            <span>Close Database</span>
            <span className="studio-context-shortcut">⇧⌘.</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onEditConnection(conn))}
          >
            <span>Edit Database...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewDatabase(conn))}
          >
            <span>New Database...</span>
          </div>

          <div 
            className="studio-context-item text-danger"
            onClick={() => handleAction(() => onDeleteDatabase(conn, databaseName || conn.database || ''))}
          >
            <span>Delete Database</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewQuery(conn.id))}
          >
            <span>New Query</span>
            <span className="studio-context-shortcut">⌘Y</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenConsole(conn.id))}
          >
            <span>Console</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onExecuteSqlFile(conn))}
          >
            <span>Execute SQL File...</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('dump-db-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Dump SQL File</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'dump-db-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => onDumpSqlFile(conn, 'all'))}>
                  <span>Structure and Data...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onDumpSqlFile(conn, 'structure'))}>
                  <span>Structure Only...</span>
                </div>
              </div>
            )}
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => window.print())}
          >
            <span>Print Database...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onReverseToModel(conn.id))}
          >
            <span>Reverse Database to Model...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewQuery(conn.id, `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = '${conn.database || 'public'}';`))}
          >
            <span>Find in Database...</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}

      {/* 3. GROUP CONTEXT MENU: TABLES */}
      {type === 'group' && group === 'tables' && (
        <>
          <div className="studio-context-item disabled">
            <span>Open Table</span>
            <span className="studio-context-shortcut">⌘O</span>
          </div>

          <div className="studio-context-item disabled">
            <span>Design Table</span>
            <span className="studio-context-shortcut">⌘D</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewTable(conn.id))}
          >
            <span>New Table</span>
            <span className="studio-context-shortcut">⌘N</span>
          </div>

          <div className="studio-context-item disabled">
            <span>Delete Table</span>
          </div>

          <div className="studio-context-item disabled">
            <span>Empty Table</span>
          </div>

          <div className="studio-context-item disabled">
            <span>Truncate Table</span>
          </div>

          <div className="studio-context-item with-submenu disabled">
            <span>Duplicate Table</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
          </div>

          <div className="studio-context-item disabled">
            <span>Set Privileges</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenImportWizard(conn.id))}
          >
            <span>Import Wizard...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenExportWizard(conn.id))}
          >
            <span>Export Wizard...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenDataGenerator(conn.id))}
          >
            <span>Data Generation...</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('dump-tables-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Dump SQL File</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'dump-tables-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => onDumpSqlFile(conn, 'all'))}>
                  <span>Structure and Data...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onDumpSqlFile(conn, 'structure'))}>
                  <span>Structure Only...</span>
                </div>
              </div>
            )}
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => window.print())}
          >
            <span>Print Tables</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('maintain-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Maintain</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'maintain-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'ANALYZE TABLE;'))}>
                  <span>Analyze Table</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'CHECK TABLE;'))}>
                  <span>Check Table</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'OPTIMIZE TABLE;'))}>
                  <span>Optimize Table</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onNewQuery(conn.id, 'REPAIR TABLE;'))}>
                  <span>Repair Table</span>
                </div>
              </div>
            )}
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onReverseToModel(conn.id))}
          >
            <span>Reverse Tables to Model...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onCreateChart(conn.id))}
          >
            <span>Create Chart...</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('group-tables-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Manage Group</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'group-tables-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => alert('New Table Group'))}>
                  <span>New Group...</span>
                </div>
              </div>
            )}
          </div>

          <div className="studio-context-separator" />

          <div className="studio-context-item disabled">
            <span>Copy</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Paste</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Rename</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}

      {/* 4. GROUP CONTEXT MENU: VIEWS */}
      {type === 'group' && group === 'views' && (
        <>
          <div className="studio-context-item disabled">
            <span>Open View</span>
            <span className="studio-context-shortcut">⌘O</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Design View</span>
            <span className="studio-context-shortcut">⌘D</span>
          </div>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewView(conn.id))}
          >
            <span>New View</span>
            <span className="studio-context-shortcut">⌘N</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Delete View</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Duplicate View</span>
            <span className="studio-context-shortcut">⇧⌘D</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Set Privileges</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenExportWizard(conn.id))}
          >
            <span>Export Wizard...</span>
          </div>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onReverseToModel(conn.id))}
          >
            <span>Reverse Views to Model...</span>
          </div>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onCreateChart(conn.id))}
          >
            <span>Create Chart...</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('group-views-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Manage Group</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'group-views-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => alert('New View Group'))}>
                  <span>New Group...</span>
                </div>
              </div>
            )}
          </div>

          <div className="studio-context-separator" />

          <div className="studio-context-item disabled">
            <span>Copy</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Paste</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Rename</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}

      {/* 5. GROUP CONTEXT MENU: FUNCTIONS / PROCEDURES */}
      {type === 'group' && (group === 'functions' || group === 'procedures') && (
        <>
          <div className="studio-context-item disabled">
            <span>Design {group === 'functions' ? 'Function' : 'Procedure'}</span>
            <span className="studio-context-shortcut">⌘D</span>
          </div>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewRoutine(group === 'functions' ? 'function' : 'procedure', conn.id))}
          >
            <span>New {group === 'functions' ? 'Function' : 'Procedure'}</span>
            <span className="studio-context-shortcut">⌘N</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Delete {group === 'functions' ? 'Function' : 'Procedure'}</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Duplicate {group === 'functions' ? 'Function' : 'Procedure'}</span>
            <span className="studio-context-shortcut">⇧⌘D</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Execute {group === 'functions' ? 'Function' : 'Procedure'}</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Set Privileges</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('group-routines-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Manage Group</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'group-routines-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => alert('New Routine Group'))}>
                  <span>New Group...</span>
                </div>
              </div>
            )}
          </div>

          <div className="studio-context-separator" />

          <div className="studio-context-item disabled">
            <span>Copy</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Paste</span>
          </div>
          <div className="studio-context-item disabled">
            <span>Rename</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}

      {/* 6. TABLE LEAF CONTEXT MENU */}
      {type === 'table-leaf' && itemName && (
        <>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenTable(itemName, conn.id))}
          >
            <span>Open Table</span>
            <span className="studio-context-shortcut">⌘O</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onDesignTable(itemName, conn.id))}
          >
            <span>Design Table</span>
            <span className="studio-context-shortcut">⌘D</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewTable(conn.id))}
          >
            <span>New Table</span>
            <span className="studio-context-shortcut">⌘N</span>
          </div>

          <div 
            className="studio-context-item text-danger"
            onClick={() => handleAction(() => onDeleteTable(itemName, conn.id))}
          >
            <span>Delete Table</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onTruncateTable(itemName, conn.id))}
          >
            <span>Truncate Table</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onDuplicateTable(itemName, conn.id))}
          >
            <span>Duplicate Table...</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenImportWizard(conn.id, itemName))}
          >
            <span>Import Wizard...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenExportWizard(conn.id, itemName))}
          >
            <span>Export Wizard...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenDataGenerator(conn.id, itemName))}
          >
            <span>Data Generation...</span>
          </div>

          <div 
            className="studio-context-item with-submenu"
            onMouseEnter={() => setActiveSubmenu('dump-table-leaf-sub')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span>Dump SQL File</span>
            <ChevronRight size={12} className="studio-submenu-arrow" />
            {activeSubmenu === 'dump-table-leaf-sub' && (
              <div className="studio-context-submenu">
                <div className="studio-context-item" onClick={() => handleAction(() => onDumpSqlFile(conn, 'all', itemName))}>
                  <span>Structure and Data...</span>
                </div>
                <div className="studio-context-item" onClick={() => handleAction(() => onDumpSqlFile(conn, 'structure', itemName))}>
                  <span>Structure Only...</span>
                </div>
              </div>
            )}
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onCreateChart(conn.id, itemName))}
          >
            <span>Create Chart...</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => { navigator.clipboard?.writeText(itemName); alert(`Copied "${itemName}" to clipboard`); })}
          >
            <span>Copy Table Name</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}

      {/* 7. VIEW LEAF CONTEXT MENU */}
      {type === 'view-leaf' && itemName && (
        <>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenView(itemName, conn.id))}
          >
            <span>Open View</span>
            <span className="studio-context-shortcut">⌘O</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onDesignView(itemName, conn.id))}
          >
            <span>Design View</span>
            <span className="studio-context-shortcut">⌘D</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewView(conn.id))}
          >
            <span>New View</span>
            <span className="studio-context-shortcut">⌘N</span>
          </div>

          <div 
            className="studio-context-item text-danger"
            onClick={() => handleAction(() => onDeleteView(itemName, conn.id))}
          >
            <span>Delete View</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onOpenExportWizard(conn.id, itemName))}
          >
            <span>Export Wizard...</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => { navigator.clipboard?.writeText(itemName); alert(`Copied "${itemName}" to clipboard`); })}
          >
            <span>Copy View Name</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}

      {/* 8. ROUTINE LEAF CONTEXT MENU */}
      {type === 'routine-leaf' && itemName && (
        <>
          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onNewQuery(conn.id, `-- Routine ${itemName}\nSELECT '${itemName}'`))}
          >
            <span>Design Routine</span>
            <span className="studio-context-shortcut">⌘D</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onExecuteRoutine(itemName, conn.id))}
          >
            <span>Execute Routine</span>
          </div>

          <div 
            className="studio-context-item text-danger"
            onClick={() => handleAction(() => onDeleteRoutine('procedure', itemName, conn.id))}
          >
            <span>Delete Routine</span>
          </div>

          <div className="studio-context-separator" />

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => { navigator.clipboard?.writeText(itemName); alert(`Copied "${itemName}" to clipboard`); })}
          >
            <span>Copy Name</span>
          </div>

          <div 
            className="studio-context-item"
            onClick={() => handleAction(() => onRefreshConnection(conn.id))}
          >
            <span>Refresh</span>
            <span className="studio-context-shortcut">⌘R</span>
          </div>
        </>
      )}
    </div>
  );
};
