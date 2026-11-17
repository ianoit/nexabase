import React from 'react';
import { 
  Database, 
  Plus, 
  Terminal, 
  Share2, 
  PenTool, 
  BarChart3, 
  Sparkles, 
  ArrowUpDown, 
  Monitor, 
  Cpu, 
  Sun, 
  Moon,
  Layers,
  GitCompare,
  Code,
  Activity,
  ShieldCheck,
  Archive,
  BookOpen,
  Code2
} from 'lucide-react';
import type { DatabaseConnection } from '../types/database';

interface NavbarProps {
  activeConnection: DatabaseConnection | null;
  onOpenNewConnection: () => void;
  onOpenNewQuery: () => void;
  onOpenErDiagram: () => void;
  onOpenTableDesigner: () => void;
  onOpenCharts: () => void;
  onOpenDataGenerator: () => void;
  onOpenExportImport: () => void;
  onOpenStructureSync: () => void;
  onOpenQueryBuilder: () => void;
  onOpenServerMonitor: () => void;
  onOpenUserManager: () => void;
  onOpenBackupRestore: () => void;
  onOpenDataDictionary: () => void;
  onOpenSnippetManager: () => void;
  onOpenCrossPlatform: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeConnection,
  onOpenNewConnection,
  onOpenNewQuery,
  onOpenErDiagram,
  onOpenTableDesigner,
  onOpenCharts,
  onOpenDataGenerator,
  onOpenExportImport,
  onOpenStructureSync,
  onOpenQueryBuilder,
  onOpenServerMonitor,
  onOpenUserManager,
  onOpenBackupRestore,
  onOpenDataDictionary,
  onOpenSnippetManager,
  onOpenCrossPlatform,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="app-navbar">
      {/* Left: Brand */}
      <div className="navbar-brand">
        <div className="brand-icon-wrapper">
          <Database className="brand-icon" />
          <div className="brand-dot"></div>
        </div>
        <div className="brand-text">
          <div className="brand-title">
            <span className="brand-name">Nexabase</span>
            <span className="brand-badge">STUDIO</span>
          </div>
          <span className="brand-subtitle">Studio Re-Engineered Suite</span>
        </div>
      </div>

      {/* Middle: Studio Quick Actions Toolbar */}
      <div className="navbar-toolbar">
        <button 
          className="tool-btn primary" 
          onClick={onOpenNewConnection} 
          title="New Database Connection (Studio Style)"
        >
          <Plus size={15} />
          <span>Connection</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenNewQuery} 
          title="Open SQL Query Editor"
        >
          <Terminal size={14} />
          <span>New Query</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenQueryBuilder} 
          title="Visual Drag-and-Drop Query Builder (QueryDesign)"
        >
          <Code size={14} />
          <span>Query Builder</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenErDiagram} 
          title="Visual Database Model / ER Diagram (libdbdiagram & libogdf)"
        >
          <Share2 size={14} />
          <span>Model (ER)</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenStructureSync} 
          title="Schema & Structure Synchronization (StructureSync)"
        >
          <GitCompare size={14} />
          <span>Structure Sync</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenTableDesigner} 
          title="Table Structure & Schema Designer"
        >
          <PenTool size={14} />
          <span>Design Table</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenCharts} 
          title="Visual Data Analytics & Charts (libncharts)"
        >
          <BarChart3 size={14} />
          <span>Charts</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenServerMonitor} 
          title="Server Monitor & Process Manager (ServerMonitor)"
        >
          <Activity size={14} />
          <span>Server Monitor</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenUserManager} 
          title="User & Privilege Manager (PrivilegeManager)"
        >
          <ShieldCheck size={14} />
          <span>Users</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenBackupRestore} 
          title="Database Backup & Restore Wizard"
        >
          <Archive size={14} />
          <span>Backup/Restore</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenDataDictionary} 
          title="Generate Data Dictionary / Schema Documentation"
        >
          <BookOpen size={14} />
          <span>Dictionary</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenSnippetManager} 
          title="SQL Snippets Library"
        >
          <Code2 size={14} />
          <span>Snippets</span>
        </button>

        <div className="tool-separator"></div>

        <button 
          className="tool-btn" 
          onClick={onOpenDataGenerator} 
          title="Generate Synthetic Test Data (datagen)"
        >
          <Sparkles size={14} />
          <span>Data Gen</span>
        </button>

        <button 
          className="tool-btn" 
          onClick={onOpenExportImport} 
          title="Export / Import Wizard (CSV, JSON, SQL)"
        >
          <ArrowUpDown size={14} />
          <span>Transfer</span>
        </button>
      </div>

      {/* Right: Environment & Active Info */}
      <div className="navbar-right">
        {/* Active connection pill */}
        <div className="active-conn-badge" title="Active Connection">
          <div className="conn-status-indicator online"></div>
          <Layers size={13} className="conn-type-icon" />
          <span className="conn-name-text">
            {activeConnection ? activeConnection.name : 'No Connection'}
          </span>
          <span className="conn-engine-tag">
            {activeConnection ? activeConnection.engine.toUpperCase() : 'NONE'}
          </span>
        </div>

        {/* Cross-Platform button */}
        <button 
          className="platform-chip-btn" 
          onClick={onOpenCrossPlatform}
          title="Cross-Platform Support (macOS, Windows, Linux)"
        >
          <Monitor size={14} />
          <span>Win • Mac • Linux</span>
          <Cpu size={12} className="pulse-icon" />
        </button>

        {/* Theme toggle */}
        <button 
          className="icon-action-btn" 
          onClick={onToggleTheme} 
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
};
