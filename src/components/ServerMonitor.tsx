import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Trash2, 
  RefreshCw, 
  Search, 
  Settings 
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';

interface ServerMonitorProps {
  connectionId: string;
}

interface ProcessInfo {
  pid: number;
  user: string;
  host: string;
  db: string;
  command: string;
  timeSec: number;
  state: string;
  query: string;
}

const INITIAL_PROCESSES: ProcessInfo[] = [
  { pid: 1042, user: 'admin', host: 'localhost:51240', db: 'ecommerce_main', command: 'Query', timeSec: 0, state: 'Executing', query: 'SELECT * FROM products ORDER BY price DESC;' },
  { pid: 1043, user: 'app_service', host: '10.0.4.12:44210', db: 'ecommerce_main', command: 'Sleep', timeSec: 14, state: 'Idle', query: '-- Connection pooled' },
  { pid: 1045, user: 'sync_worker', host: '10.0.4.18:38190', db: 'ecommerce_main', command: 'Query', timeSec: 2, state: 'Writing to disk', query: 'INSERT INTO inventory_logs VALUES (...);' },
  { pid: 1048, user: 'reporting', host: '10.0.5.2:59021', db: 'analytics_dw', command: 'Sleep', timeSec: 42, state: 'Waiting for table metadata lock', query: 'SELECT COUNT(*) FROM orders;' },
];

export const ServerMonitor: React.FC<ServerMonitorProps> = ({ connectionId }) => {
  const [activeTab, setActiveTab] = useState<'processes' | 'variables'>('processes');
  const [processes, setProcesses] = useState<ProcessInfo[]>(INITIAL_PROCESSES);
  const [searchQuery, setSearchQuery] = useState('');
  const [cpuUsage, setCpuUsage] = useState(14);
  const [queriesPerSec, setQueriesPerSec] = useState(128);
  const [pragmas, setPragmas] = useState<{ name: string; value: string }[]>([]);

  // Periodically refresh simulated metrics
  useEffect(() => {
    const timer = setInterval(() => {
      setCpuUsage(Math.floor(10 + Math.random() * 15));
      setQueriesPerSec(Math.floor(95 + Math.random() * 60));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real SQLite PRAGMA variables
  useEffect(() => {
    try {
      const vars = ['cache_size', 'page_size', 'synchronous', 'journal_mode', 'foreign_keys', 'encoding'];
      const loaded: { name: string; value: string }[] = [];
      vars.forEach(v => {
        const res = dbEngine.execute(connectionId, `PRAGMA ${v};`);
        const val = res.values[0]?.[0] !== undefined ? String(res.values[0][0]) : 'DEFAULT';
        loaded.push({ name: v, value: val });
      });
      setPragmas(loaded);
    } catch {
      // ignore
    }
  }, [connectionId]);

  const killProcess = (pid: number) => {
    if (confirm(`Are you sure you want to kill process PID #${pid}?`)) {
      setProcesses(prev => prev.filter(p => p.pid !== pid));
    }
  };

  const filteredProcesses = processes.filter(p => 
    p.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.db.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="server-monitor-container">
      {/* Top Header */}
      <div className="monitor-header-bar">
        <div className="monitor-title-group">
          <Activity size={16} className="text-cyan" />
          <h4>Server Monitor & Process Manager (Studio ServerMonitor)</h4>
        </div>

        <div className="monitor-tabs">
          <button 
            className={`mon-tab ${activeTab === 'processes' ? 'active' : ''}`}
            onClick={() => setActiveTab('processes')}
          >
            Process List ({processes.length})
          </button>
          <button 
            className={`mon-tab ${activeTab === 'variables' ? 'active' : ''}`}
            onClick={() => setActiveTab('variables')}
          >
            <Settings size={13} />
            <span>Server Variables / PRAGMA</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="monitor-kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">ACTIVE CONNECTIONS</div>
          <div className="kpi-value text-cyan">{processes.length}</div>
          <div className="kpi-sub">Threads connected</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">QUERIES / SEC</div>
          <div className="kpi-value text-emerald">{queriesPerSec} QPS</div>
          <div className="kpi-sub">Database throughput</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">CPU UTILIZATION</div>
          <div className="kpi-value">{cpuUsage}%</div>
          <div className="kpi-sub">Engine execution thread</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">BUFFER CACHE HIT</div>
          <div className="kpi-value text-indigo">99.4%</div>
          <div className="kpi-sub">In-Memory Page Cache</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="monitor-body-viewport">
        {activeTab === 'processes' ? (
          <div className="process-list-view">
            <div className="process-toolbar">
              <div className="search-bar" style={{ width: '260px' }}>
                <Search size={13} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Filter process by user or query..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="process-actions">
                <button 
                  className="action-btn-sm" 
                  onClick={() => {
                    setProcesses(prev => [
                      ...prev,
                      {
                        pid: Math.floor(1000 + Math.random() * 9000),
                        user: 'worker',
                        host: 'localhost',
                        db: 'ecommerce_main',
                        command: 'Query',
                        timeSec: 1,
                        state: 'Executing',
                        query: 'SELECT * FROM customers WHERE loyalty_points > 100;',
                      }
                    ]);
                  }}
                >
                  <RefreshCw size={12} /> Refresh Processes
                </button>
              </div>
            </div>

            <table className="process-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>PID</th>
                  <th>User</th>
                  <th>Host</th>
                  <th>Database</th>
                  <th>Command</th>
                  <th style={{ width: '70px' }}>Time (s)</th>
                  <th>State</th>
                  <th>Current Query / Statement</th>
                  <th style={{ width: '80px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcesses.map(proc => (
                  <tr key={proc.pid}>
                    <td className="center-cell font-mono">#{proc.pid}</td>
                    <td><strong>{proc.user}</strong></td>
                    <td className="text-muted font-mono">{proc.host}</td>
                    <td><span className="db-pill">{proc.db}</span></td>
                    <td>
                      <span className={`cmd-pill ${proc.command.toLowerCase()}`}>
                        {proc.command}
                      </span>
                    </td>
                    <td className="center-cell font-mono">{proc.timeSec}s</td>
                    <td><span className="state-pill">{proc.state}</span></td>
                    <td className="query-cell font-mono">{proc.query}</td>
                    <td className="center-cell">
                      <button 
                        className="kill-btn"
                        onClick={() => killProcess(proc.pid)}
                        title="End Process (Kill Thread)"
                      >
                        <Trash2 size={12} />
                        <span>Kill</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="variables-list-view">
            <div className="var-header-prompt">
              <span>Server Runtime Parameters & Storage Engine Directives</span>
            </div>
            <table className="process-table">
              <thead>
                <tr>
                  <th>Parameter / Directive</th>
                  <th>Current Value</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {pragmas.map(p => (
                  <tr key={p.name}>
                    <td className="font-mono"><strong>{p.name}</strong></td>
                    <td><span className="val-badge font-mono">{p.value}</span></td>
                    <td className="text-muted">
                      {p.name === 'cache_size' ? 'Maximum memory page cache allocations' :
                       p.name === 'journal_mode' ? 'Atomic transaction rollback log algorithm (WAL/DELETE)' :
                       p.name === 'foreign_keys' ? 'Enforcement of foreign key integrity constraints' :
                       p.name === 'synchronous' ? 'Disk sync frequency mode' : 'Internal engine configuration'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
