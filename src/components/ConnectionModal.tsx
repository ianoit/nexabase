import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  ShieldCheck, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';
import type { DatabaseConnection, DatabaseEngine } from '../types/database';
import { dbGateway } from '../services/dbGateway';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (conn: DatabaseConnection) => void;
  initialEngine?: DatabaseEngine;
  initialConnection?: DatabaseConnection | null;
}

const DEFAULT_PORTS: Record<DatabaseEngine, number> = {
  sqlite: 0,
  mysql: 3306,
  postgres: 5432,
  mariadb: 3306,
  mongodb: 27017,
  redis: 6379,
  mssql: 1433,
};

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEngine,
  initialConnection,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ssl' | 'ssh'>('general');
  const [engine, setEngine] = useState<DatabaseEngine>(initialConnection?.engine || initialEngine || 'sqlite');
  const [name, setName] = useState(initialConnection?.name || 'My Local SQLite');
  const [host, setHost] = useState(initialConnection?.host || '127.0.0.1');
  const [port, setPort] = useState<number>(initialConnection?.port ?? 0);
  const [database, setDatabase] = useState(initialConnection?.database || 'main.db');
  const [username, setUsername] = useState(initialConnection?.username || 'root');
  const [password, setPassword] = useState(initialConnection?.password || '');
  
  // SSL
  const [useSsl, setUseSsl] = useState(!!initialConnection?.useSsl);
  const [sslAuthMethod, setSslAuthMethod] = useState('require');

  // SSH
  const [useSsh, setUseSsh] = useState(!!initialConnection?.useSsh);
  const [sshHost, setSshHost] = useState(initialConnection?.sshHost || 'bastion.corp.net');
  const [sshPort, setSshPort] = useState(initialConnection?.sshPort ?? 22);
  const [sshUser, setSshUser] = useState(initialConnection?.sshUser || 'ssh_tunnel');

  // Test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialConnection) {
      setEngine(initialConnection.engine);
      setName(initialConnection.name);
      setHost(initialConnection.host || '127.0.0.1');
      setPort(initialConnection.port ?? DEFAULT_PORTS[initialConnection.engine]);
      setDatabase(initialConnection.database || '');
      setUsername(initialConnection.username || '');
      setPassword(initialConnection.password || '');
      setUseSsl(!!initialConnection.useSsl);
      setUseSsh(!!initialConnection.useSsh);
      if (initialConnection.sshHost) setSshHost(initialConnection.sshHost);
      if (initialConnection.sshPort) setSshPort(initialConnection.sshPort);
      if (initialConnection.sshUser) setSshUser(initialConnection.sshUser);
      setTestResult(null);
    } else if (initialEngine) {
      handleEngineChange(initialEngine);
    }
  }, [initialEngine, initialConnection, isOpen]);

  const handleEngineChange = (newEngine: DatabaseEngine) => {
    setEngine(newEngine);
    setPort(DEFAULT_PORTS[newEngine]);
    if (newEngine === 'sqlite') {
      setName('Local SQLite DB');
      setDatabase('database.sqlite');
    } else if (newEngine === 'postgres') {
      setName('PostgreSQL Database');
      setDatabase('postgres');
      setUsername('postgres');
    } else if (newEngine === 'mysql' || newEngine === 'mariadb') {
      setName('MySQL / MariaDB Cluster');
      setDatabase('production_db');
      setUsername('root');
    } else if (newEngine === 'mongodb') {
      setName('MongoDB Atlas / Cluster');
      setDatabase('app_db');
      setUsername('admin');
    } else if (newEngine === 'redis') {
      setName('Redis Cache Server');
      setDatabase('0');
      setUsername('');
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const testConn: DatabaseConnection = {
      id: 'test-preview',
      name,
      engine,
      host,
      port,
      database,
      username,
      password,
      useSsl,
    };

    try {
      const res = await dbGateway.testConnection(testConn);
      setIsTesting(false);
      setTestResult({
        success: res.success,
        message: res.message || res.error || (res.success ? 'Connection successful!' : 'Connection failed.'),
        latencyMs: res.latencyMs,
      });
    } catch (e: any) {
      setIsTesting(false);
      setTestResult({
        success: false,
        message: e?.message || 'Connection test failed.',
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const savedConn: DatabaseConnection = {
      id: initialConnection?.id || `conn-${Date.now()}`,
      name: name.trim() || `${engine.toUpperCase()} Connection`,
      engine,
      host: engine === 'sqlite' ? undefined : host,
      port: engine === 'sqlite' ? undefined : port,
      database,
      username: engine === 'sqlite' ? undefined : username,
      password: engine === 'sqlite' ? undefined : password,
      useSsl,
      useSsh,
      sshHost: useSsh ? sshHost : undefined,
      sshPort: useSsh ? sshPort : undefined,
      sshUser: useSsh ? sshUser : undefined,
      connectedAt: initialConnection?.connectedAt || 'Connected just now',
      colorTag: initialConnection?.colorTag,
      isClosed: initialConnection?.isClosed,
    };
    onSave(savedConn);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container connection-dialog">
        <div className="modal-header">
          <div className="modal-title-row">
            <Database className="modal-icon" />
            <h3>{initialConnection ? 'Edit Connection' : 'New Database Connection'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Engine selector grid */}
        <div className="engine-select-group">
          <label className="section-label">SELECT DATABASE ENGINE</label>
          <div className="engine-cards-grid">
            {(['sqlite', 'mysql', 'postgres', 'mariadb', 'mongodb', 'redis'] as DatabaseEngine[]).map(eng => (
              <div 
                key={eng}
                className={`engine-card ${engine === eng ? 'selected' : ''}`}
                onClick={() => handleEngineChange(eng)}
              >
                <div className={`engine-badge-icon ${eng}`}>
                  <Database size={16} />
                </div>
                <div className="engine-card-info">
                  <span className="engine-card-name">
                    {eng === 'sqlite' ? 'SQLite (WASM/File)' : 
                     eng === 'mysql' ? 'MySQL 8.x' : 
                     eng === 'postgres' ? 'PostgreSQL' : 
                     eng === 'mariadb' ? 'MariaDB' : 
                     eng === 'mongodb' ? 'MongoDB' : 'Redis'}
                  </span>
                  <span className="engine-card-sub">
                    {eng === 'sqlite' ? 'Local / In-Memory' : `Default Port: ${DEFAULT_PORTS[eng]}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connection Tabs */}
        <div className="dialog-tabs-bar">
          <button 
            type="button"
            className={`dialog-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button 
            type="button"
            className={`dialog-tab ${activeTab === 'ssl' ? 'active' : ''}`}
            onClick={() => setActiveTab('ssl')}
          >
            <ShieldCheck size={13} />
            <span>SSL / TLS</span>
          </button>
          <button 
            type="button"
            className={`dialog-tab ${activeTab === 'ssh' ? 'active' : ''}`}
            onClick={() => setActiveTab('ssh')}
          >
            <Server size={13} />
            <span>SSH Tunnel</span>
          </button>
        </div>

        {/* Tab Form Content */}
        <form onSubmit={handleSave} className="dialog-form-body">
          {activeTab === 'general' && (
            <div className="tab-pane">
              <div className="form-row">
                <div className="form-field flex-2">
                  <label>Connection Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Production Analytics"
                    required
                  />
                </div>
                <div className="form-field flex-1">
                  <label>Engine</label>
                  <input type="text" value={engine.toUpperCase()} readOnly disabled />
                </div>
              </div>

              {engine === 'sqlite' ? (
                <div className="form-field">
                  <label>Database File / Name</label>
                  <input 
                    type="text" 
                    value={database} 
                    onChange={e => setDatabase(e.target.value)}
                    placeholder="e.g. main.db or :memory:"
                    required
                  />
                  <span className="field-hint">Runs with full SQLite 3 WebAssembly engine directly on your device.</span>
                </div>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-field flex-2">
                      <label>Host / IP Address</label>
                      <input 
                        type="text" 
                        value={host} 
                        onChange={e => setHost(e.target.value)}
                        placeholder="localhost or db.example.com"
                        required
                      />
                    </div>
                    <div className="form-field flex-1">
                      <label>Port</label>
                      <input 
                        type="number" 
                        value={port} 
                        onChange={e => setPort(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Database Name</label>
                    <input 
                      type="text" 
                      value={database} 
                      onChange={e => setDatabase(e.target.value)}
                      placeholder="e.g. production_db"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-field flex-1">
                      <label>Username</label>
                      <input 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)}
                        placeholder="root or dba"
                      />
                    </div>
                    <div className="form-field flex-1">
                      <label>Password</label>
                      <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'ssl' && (
            <div className="tab-pane">
              <div className="checkbox-field">
                <input 
                  type="checkbox" 
                  id="chk-ssl" 
                  checked={useSsl} 
                  onChange={e => setUseSsl(e.target.checked)} 
                />
                <label htmlFor="chk-ssl">Use SSL/TLS Encrypted Connection</label>
              </div>

              {useSsl && (
                <div className="sub-fields-box">
                  <div className="form-field">
                    <label>SSL Mode</label>
                    <select value={sslAuthMethod} onChange={e => setSslAuthMethod(e.target.value)}>
                      <option value="require">Require (Encrypt traffic)</option>
                      <option value="verify-ca">Verify CA</option>
                      <option value="verify-full">Verify Full (CA & Hostname)</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>CA Certificate (Optional)</label>
                    <input type="text" placeholder="/path/to/ca.pem" />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ssh' && (
            <div className="tab-pane">
              <div className="checkbox-field">
                <input 
                  type="checkbox" 
                  id="chk-ssh" 
                  checked={useSsh} 
                  onChange={e => setUseSsh(e.target.checked)} 
                />
                <label htmlFor="chk-ssh">Use SSH Tunnel (Port Forwarding)</label>
              </div>

              {useSsh && (
                <div className="sub-fields-box">
                  <div className="form-row">
                    <div className="form-field flex-2">
                      <label>SSH Host</label>
                      <input 
                        type="text" 
                        value={sshHost} 
                        onChange={e => setSshHost(e.target.value)}
                        placeholder="bastion.example.com"
                      />
                    </div>
                    <div className="form-field flex-1">
                      <label>SSH Port</label>
                      <input 
                        type="number" 
                        value={sshPort} 
                        onChange={e => setSshPort(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>SSH Username</label>
                    <input 
                      type="text" 
                      value={sshUser} 
                      onChange={e => setSshUser(e.target.value)}
                      placeholder="ec2-user or admin"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Status feedback */}
          {testResult && (
            <div className={`connection-feedback ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="modal-footer-row">
            <button 
              type="button" 
              className="btn secondary"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? <Loader2 size={14} className="spin-icon" /> : null}
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="footer-actions-right">
              <button type="button" className="btn secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Save & Connect
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
