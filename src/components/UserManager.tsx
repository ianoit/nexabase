import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2 
} from 'lucide-react';

interface UserAccount {
  id: string;
  username: string;
  host: string;
  role: string;
  privileges: string[];
}

const INITIAL_USERS: UserAccount[] = [
  { id: '1', username: 'root', host: '%', role: 'Superadmin', privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX', 'GRANT OPTION'] },
  { id: '2', username: 'dba_admin', host: '10.0.%', role: 'Database Administrator', privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'INDEX'] },
  { id: '3', username: 'app_service', host: '10.0.4.%', role: 'Application API', privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { id: '4', username: 'readonly_analyst', host: '10.0.5.%', role: 'BI Analyst', privileges: ['SELECT'] },
  { id: '5', username: 'backup_agent', host: 'localhost', role: 'Backup Worker', privileges: ['SELECT', 'LOCK TABLES', 'SHOW VIEW'] },
];

const ALL_PRIVILEGES = [
  { category: 'Data Privileges', items: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { category: 'Structure Privileges', items: ['CREATE', 'DROP', 'ALTER', 'INDEX', 'CREATE VIEW'] },
  { category: 'Administration', items: ['GRANT OPTION', 'SUPER', 'PROCESS', 'RELOAD', 'LOCK TABLES'] },
];

export const UserManager: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [selectedUserId, setSelectedUserId] = useState<string>('3');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];

  const togglePrivilege = (priv: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== selectedUserId) return u;
      const hasPriv = u.privileges.includes(priv);
      const newPrivs = hasPriv 
        ? u.privileges.filter(p => p !== priv)
        : [...u.privileges, priv];
      return { ...u, privileges: newPrivs };
    }));
  };

  const handleAddUser = () => {
    const newId = `user-${Date.now()}`;
    const newUser: UserAccount = {
      id: newId,
      username: `new_user_${users.length + 1}`,
      host: '%',
      role: 'Custom Role',
      privileges: ['SELECT'],
    };
    setUsers(prev => [...prev, newUser]);
    setSelectedUserId(newId);
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) return;
    if (confirm('Are you sure you want to delete this user?')) {
      const remaining = users.filter(u => u.id !== id);
      setUsers(remaining);
      setSelectedUserId(remaining[0].id);
    }
  };

  const generateGrantSql = () => {
    if (!selectedUser) return '';
    const privs = selectedUser.privileges.join(', ') || 'USAGE';
    return `-- Grant Privileges for User: ${selectedUser.username}\nGRANT ${privs} ON *.* TO '${selectedUser.username}'@'${selectedUser.host}';\nFLUSH PRIVILEGES;`;
  };

  const handleSave = () => {
    setSaveStatus(`Privileges for user "${selectedUser.username}" saved successfully!`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div className="user-manager-container">
      {/* Header bar */}
      <div className="user-header-bar">
        <div className="user-title-group">
          <ShieldCheck size={16} className="text-cyan" />
          <h4>User & Privilege Manager</h4>
        </div>

        <div className="user-header-actions">
          <button className="action-btn-sm" onClick={handleAddUser}>
            <Plus size={13} /> Add User
          </button>
          <button className="action-btn-sm primary" onClick={handleSave}>
            <Save size={13} /> Save Privileges
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="sync-success-alert">
          <CheckCircle2 size={16} />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="user-main-split">
        {/* Left: User List */}
        <div className="users-sidebar-pane">
          <div className="pane-header">
            <span>DATABASE USERS ({users.length})</span>
          </div>
          <div className="users-list">
            {users.map(u => {
              const isSelected = u.id === selectedUserId;
              return (
                <div 
                  key={u.id}
                  className={`user-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <div className="user-avatar">
                    <Users size={14} />
                  </div>
                  <div className="user-meta">
                    <strong>{u.username}</strong>
                    <span className="user-host text-muted font-mono">@{u.host}</span>
                    <span className="user-role-badge">{u.role}</span>
                  </div>
                  {users.length > 1 && (
                    <button 
                      className="del-user-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUser(u.id);
                      }}
                      title="Delete User"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: User Properties & Privileges Grid */}
        <div className="user-details-pane">
          <div className="user-props-card">
            <h4>Account Settings: {selectedUser.username}@{selectedUser.host}</h4>
            <div className="form-row">
              <div className="form-field flex-2">
                <label>Username</label>
                <input 
                  type="text" 
                  value={selectedUser.username}
                  onChange={e => setUsers(prev => prev.map(u => u.id === selectedUserId ? { ...u, username: e.target.value } : u))}
                />
              </div>
              <div className="form-field flex-1">
                <label>Host Wildcard</label>
                <input 
                  type="text" 
                  value={selectedUser.host}
                  onChange={e => setUsers(prev => prev.map(u => u.id === selectedUserId ? { ...u, host: e.target.value } : u))}
                />
              </div>
            </div>
          </div>

          {/* Privileges Matrix */}
          <div className="privileges-matrix-card">
            <h4>Privilege Grants</h4>
            <div className="matrix-columns">
              {ALL_PRIVILEGES.map(cat => (
                <div key={cat.category} className="priv-category-box">
                  <div className="cat-title">{cat.category}</div>
                  <div className="priv-checkboxes-list">
                    {cat.items.map(p => {
                      const isGranted = selectedUser.privileges.includes(p);
                      return (
                        <label key={p} className={`priv-checkbox-item ${isGranted ? 'granted' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={isGranted} 
                            onChange={() => togglePrivilege(p)}
                          />
                          <span>{p}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SQL Preview */}
          <div className="grant-sql-preview">
            <span className="grant-label">Generated SQL DDL Script</span>
            <pre className="grant-code">{generateGrantSql()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
