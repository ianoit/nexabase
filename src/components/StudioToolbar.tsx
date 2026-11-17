import React, { useState } from 'react';
import { 
  Plus, 
  Table as TableIcon, 
  Eye, 
  User, 
  Boxes, 
  RotateCcw, 
  Bot, 
  Share2, 
  BarChart3, 
  PanelLeft, 
  PanelRight, 
  ChevronDown,
  GitCompare,
  Activity,
  BookOpen,
  Code2,
  Sparkles,
  ArrowUpDown,
  Workflow,
  Zap
} from 'lucide-react';
import type { DatabaseConnection, DatabaseEngine } from '../types/database';

export type StudioSection = 
  | 'table' 
  | 'view' 
  | 'procedure'
  | 'function' 
  | 'trigger'
  | 'user' 
  | 'others' 
  | 'query' 
  | 'backup' 
  | 'automation' 
  | 'model' 
  | 'charts';

interface StudioToolbarProps {
  activeSection: StudioSection;
  onSelectSection: (section: StudioSection) => void;
  activeConnection: DatabaseConnection | null;
  onOpenNewConnection: (engine?: DatabaseEngine) => void;
  onOpenNewQuery: () => void;
  onOpenStructureSync: () => void;
  onOpenServerMonitor: () => void;
  onOpenDataDictionary: () => void;
  onOpenSnippetManager: () => void;
  onOpenDataGenerator: () => void;
  onOpenExportImport: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
}

export const StudioToolbar: React.FC<StudioToolbarProps> = ({
  activeSection,
  onSelectSection,
  onOpenNewConnection,
  onOpenNewQuery,
  onOpenStructureSync,
  onOpenServerMonitor,
  onOpenDataDictionary,
  onOpenSnippetManager,
  onOpenDataGenerator,
  onOpenExportImport,
  showSidebar,
  onToggleSidebar,
  showInspector,
  onToggleInspector,
}) => {
  const [showOthersMenu, setShowOthersMenu] = useState(false);
  const [showConnMenu, setShowConnMenu] = useState(false);
  return (
    <div className="studio-window-header">
      {/* Main Studio Toolbar */}
      <div className="studio-toolbar-row">
        <div className="studio-tools-group">
          {/* 1. Connection Button */}
          <div className="studio-btn-dropdown-wrapper">
            <button 
              className="studio-tool-btn" 
              onClick={() => {
                setShowConnMenu(false);
                onOpenNewConnection();
              }}
              title="New Database Connection"
            >
              <div className="tool-icon-box connection-icon">
                <span className="conn-status-dot"></span>
                <Plus size={18} strokeWidth={2.5} />
              </div>
              <div className="tool-label-row">
                <span>Connection</span>
                <span 
                  className="dropdown-arrow-hitbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConnMenu(!showConnMenu);
                  }}
                  title="Choose Database Engine..."
                >
                  <ChevronDown size={10} className="dropdown-arrow" />
                </span>
              </div>
            </button>
            {showConnMenu && (
              <div className="studio-popup-menu">
                <div className="popup-item" onClick={() => { setShowConnMenu(false); onOpenNewConnection('mysql'); }}>
                  <Plus size={14} /> New MySQL / MariaDB Connection...
                </div>
                <div className="popup-item" onClick={() => { setShowConnMenu(false); onOpenNewConnection('postgres'); }}>
                  <Plus size={14} /> New PostgreSQL Connection...
                </div>
                <div className="popup-item" onClick={() => { setShowConnMenu(false); onOpenNewConnection('sqlite'); }}>
                  <Plus size={14} /> New SQLite / Local File Connection...
                </div>
                <div className="popup-item" onClick={() => { setShowConnMenu(false); onOpenNewConnection('mongodb'); }}>
                  <Plus size={14} /> New MongoDB Connection...
                </div>
                <div className="popup-item" onClick={() => { setShowConnMenu(false); onOpenNewConnection('redis'); }}>
                  <Plus size={14} /> New Redis Connection...
                </div>
              </div>
            )}
          </div>

          {/* 2. New Query Button */}
          <button 
            className="studio-tool-btn"
            onClick={onOpenNewQuery}
            title="Create New Query"
          >
            <div className="tool-icon-box new-query-icon">
              <span className="studio-term-icon">&gt;_</span>
            </div>
            <span>New Query</span>
          </button>

          {/* 3. Table Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'table' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('table')}
            title="Database Tables"
          >
            <div className="tool-icon-box table-icon">
              <TableIcon size={19} />
            </div>
            <span>Table</span>
          </button>

          {/* 4. View Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'view' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('view')}
            title="Database Views"
          >
            <div className="tool-icon-box view-icon">
              <Eye size={19} />
            </div>
            <span>View</span>
          </button>

          {/* 5. Procedure Button (Stored Procedures) */}
          <button 
            className={`studio-tool-btn ${activeSection === 'procedure' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('procedure')}
            title="Stored Procedures"
          >
            <div className="tool-icon-box procedure-icon">
              <Workflow size={19} />
            </div>
            <span>Procedure</span>
          </button>

          {/* 6. Function Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'function' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('function')}
            title="Database Functions"
          >
            <div className="tool-icon-box function-icon">
              <span className="fx-symbol">ƒ(x)</span>
            </div>
            <span>Function</span>
          </button>

          {/* 7. Trigger Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'trigger' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('trigger')}
            title="Database Triggers"
          >
            <div className="tool-icon-box trigger-icon">
              <Zap size={19} />
            </div>
            <span>Trigger</span>
          </button>

          {/* 8. User Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'user' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('user')}
            title="User & Privilege Manager"
          >
            <div className="tool-icon-box user-icon">
              <User size={19} />
            </div>
            <span>User</span>
          </button>

          {/* 9. Others Dropdown */}
          <div className="studio-btn-dropdown-wrapper">
            <button 
              className={`studio-tool-btn ${activeSection === 'others' ? 'active-section' : ''}`}
              onClick={() => setShowOthersMenu(!showOthersMenu)}
              title="Other Tools & Wizards"
            >
              <div className="tool-icon-box others-icon">
                <Boxes size={19} />
              </div>
              <div className="tool-label-row">
                <span>Others</span>
                <ChevronDown size={10} className="dropdown-arrow" />
              </div>
            </button>
            {showOthersMenu && (
              <div className="studio-popup-menu" onClick={() => setShowOthersMenu(false)}>
                <div className="popup-item" onClick={onOpenStructureSync}>
                  <GitCompare size={14} className="text-cyan" /> Structure Synchronization...
                </div>
                <div className="popup-item" onClick={onOpenServerMonitor}>
                  <Activity size={14} className="text-rose" /> Server Monitor & Process List...
                </div>
                <div className="popup-item" onClick={onOpenDataDictionary}>
                  <BookOpen size={14} className="text-purple" /> Data Dictionary Generator...
                </div>
                <div className="popup-item" onClick={onOpenSnippetManager}>
                  <Code2 size={14} className="text-cyan" /> SQL Snippet Library...
                </div>
                <div className="popup-divider"></div>
                <div className="popup-item" onClick={onOpenDataGenerator}>
                  <Sparkles size={14} className="text-amber" /> Data Generator Wizard...
                </div>
                <div className="popup-item" onClick={onOpenExportImport}>
                  <ArrowUpDown size={14} className="text-emerald" /> Data Transfer / Import / Export...
                </div>
              </div>
            )}
          </div>

          {/* 10. Query Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'query' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('query')}
            title="Queries Explorer"
          >
            <div className="tool-icon-box query-icon">
              <div className="studio-binary-icon">
                <span>01</span>
                <span>10</span>
              </div>
            </div>
            <span>Query</span>
          </button>

          {/* 11. Backup Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'backup' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('backup')}
            title="Backup & Restore Wizard"
          >
            <div className="tool-icon-box backup-icon">
              <RotateCcw size={19} />
            </div>
            <span>Backup</span>
          </button>

          {/* 12. Automation Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'automation' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('automation')}
            title="Automation & Scheduled Tasks"
          >
            <div className="tool-icon-box automation-icon">
              <Bot size={19} />
            </div>
            <span>Automation</span>
          </button>

          {/* 13. Model Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'model' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('model')}
            title="ER Diagram & Physical Model"
          >
            <div className="tool-icon-box model-icon">
              <Share2 size={19} />
            </div>
            <span>Model</span>
          </button>

          {/* 14. Charts Button */}
          <button 
            className={`studio-tool-btn ${activeSection === 'charts' ? 'active-section' : ''}`}
            onClick={() => onSelectSection('charts')}
            title="Data Charts & Dashboards"
          >
            <div className="tool-icon-box charts-icon">
              <BarChart3 size={19} />
            </div>
            <span>Charts</span>
          </button>
        </div>

        {/* Right side controls: Layout toggles & Profile */}
        <div className="studio-toolbar-right">
          <div className="layout-toggle-group">
            <button 
              className={`view-toggle-btn ${showSidebar ? 'active' : ''}`}
              onClick={onToggleSidebar}
              title="Toggle Connection Tree Sidebar"
            >
              <PanelLeft size={16} />
            </button>
            <button 
              className={`view-toggle-btn ${showInspector ? 'active' : ''}`}
              onClick={onToggleInspector}
              title="Toggle Object Information Inspector"
            >
              <PanelRight size={16} />
            </button>
          </div>
          <div className="user-profile-circle" title="User Account">
            <User size={15} />
          </div>
        </div>
      </div>
    </div>
  );
};
