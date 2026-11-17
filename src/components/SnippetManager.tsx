import React, { useState } from 'react';
import { 
  Code2, 
  Search, 
  Copy, 
  Check, 
  Plus, 
  Terminal, 
  Trash2 
} from 'lucide-react';

interface Snippet {
  id: string;
  title: string;
  category: 'DML' | 'DDL' | 'Analytics' | 'Administration';
  description: string;
  sql: string;
}

const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: '1',
    title: 'Multi-Table Inner Join with Grouping',
    category: 'DML',
    description: 'Join orders with customers and order_items to compute order totals',
    sql: `SELECT 
  c.first_name || ' ' || c.last_name AS customer_name,
  o.order_number,
  COUNT(oi.id) AS total_items,
  SUM(oi.subtotal) AS grand_total
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id
ORDER BY grand_total DESC;`,
  },
  {
    id: '2',
    title: 'Window Function: Running Cumulative Sales',
    category: 'Analytics',
    description: 'Calculate running total and moving averages over order dates',
    sql: `SELECT 
  order_date,
  total_amount,
  SUM(total_amount) OVER (ORDER BY order_date) AS running_total_revenue,
  AVG(total_amount) OVER (ORDER BY order_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3_orders
FROM orders;`,
  },
  {
    id: '3',
    title: 'Safe Create Table with Foreign Keys',
    category: 'DDL',
    description: 'Standard boilerplate for creating relational child table',
    sql: `CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  performed_by VARCHAR(50) DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
  },
  {
    id: '4',
    title: 'Database Integrity Check & Optimization',
    category: 'Administration',
    description: 'Check database corruption and reclaim unallocated space',
    sql: `PRAGMA integrity_check;
PRAGMA foreign_key_check;
VACUUM;
ANALYZE;`,
  },
  {
    id: '5',
    title: 'Find Duplicate Records Query',
    category: 'DML',
    description: 'Detect duplicates by grouping on specific columns',
    sql: `SELECT email, COUNT(*) as count
FROM customers
GROUP BY email
HAVING count > 1;`,
  },
];

interface SnippetManagerProps {
  onInsertToQuery: (sql: string) => void;
}

export const SnippetManager: React.FC<SnippetManagerProps> = ({
  onInsertToQuery,
}) => {
  const [snippets, setSnippets] = useState<Snippet[]>(DEFAULT_SNIPPETS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Snippet Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'DML' | 'DDL' | 'Analytics' | 'Administration'>('DML');
  const [newDesc, setNewDesc] = useState('');
  const [newSql, setNewSql] = useState('');

  const filteredSnippets = snippets.filter(s => {
    const matchesCat = selectedCategory === 'ALL' || s.category === selectedCategory;
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.sql.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopy = (s: Snippet) => {
    navigator.clipboard.writeText(s.sql);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSql.trim()) return;

    setSnippets(prev => [
      {
        id: `snip-${Date.now()}`,
        title: newTitle,
        category: newCategory,
        description: newDesc,
        sql: newSql,
      },
      ...prev,
    ]);

    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewSql('');
  };

  const handleDelete = (id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="snippet-manager-container">
      {/* Top Header */}
      <div className="snippet-header-bar">
        <div className="snip-title-group">
          <Code2 size={16} className="text-cyan" />
          <h4>SQL Snippets Library (Studio SnippetManager)</h4>
        </div>

        <div className="snip-actions">
          <button className="action-btn-sm primary" onClick={() => setShowAddModal(true)}>
            <Plus size={13} /> Add Custom Snippet
          </button>
        </div>
      </div>

      {/* Filter / Category Bar */}
      <div className="snip-filter-bar">
        <div className="search-bar" style={{ width: '280px' }}>
          <Search size={13} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search SQL snippets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="category-pills">
          {['ALL', 'DML', 'DDL', 'Analytics', 'Administration'].map(cat => (
            <button
              key={cat}
              className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Snippet Cards Grid */}
      <div className="snippets-grid-viewport">
        {filteredSnippets.length === 0 ? (
          <div className="sync-empty-prompt">
            <Code2 size={36} className="dim-icon" />
            <p>No snippets match your filter query.</p>
          </div>
        ) : (
          filteredSnippets.map(snip => (
            <div key={snip.id} className="snippet-card">
              <div className="snip-card-header">
                <div className="snip-heading">
                  <span className={`cat-tag ${snip.category.toLowerCase()}`}>{snip.category}</span>
                  <strong>{snip.title}</strong>
                </div>
                <div className="snip-card-actions">
                  <button 
                    className="snip-btn"
                    onClick={() => handleCopy(snip)}
                    title="Copy to Clipboard"
                  >
                    {copiedId === snip.id ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                  </button>
                  <button 
                    className="snip-btn primary"
                    onClick={() => onInsertToQuery(snip.sql)}
                    title="Insert into Query Editor"
                  >
                    <Terminal size={12} />
                    <span>Use in Editor</span>
                  </button>
                  <button 
                    className="snip-btn"
                    onClick={() => handleDelete(snip.id)}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <p className="snip-desc">{snip.description}</p>
              <pre className="snip-sql-preview">{snip.sql}</pre>
            </div>
          ))
        )}
      </div>

      {/* Add Snippet Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Create Custom SQL Snippet</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddSnippet} className="dialog-form-body">
              <div className="form-row">
                <div className="form-field flex-2">
                  <label>Snippet Title</label>
                  <input 
                    type="text" 
                    value={newTitle} 
                    onChange={e => setNewTitle(e.target.value)} 
                    placeholder="e.g. Find Inactive Users" 
                    required 
                  />
                </div>
                <div className="form-field flex-1">
                  <label>Category</label>
                  <select 
                    value={newCategory} 
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="modal-select"
                  >
                    <option value="DML">DML</option>
                    <option value="DDL">DDL</option>
                    <option value="Analytics">Analytics</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Description</label>
                <input 
                  type="text" 
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)} 
                  placeholder="Short explanation of what this query does..." 
                />
              </div>
              <div className="form-field">
                <label>SQL Template</label>
                <textarea 
                  className="sql-code-editor" 
                  style={{ height: '140px' }}
                  value={newSql} 
                  onChange={e => setNewSql(e.target.value)} 
                  placeholder="SELECT * FROM ...;"
                  required 
                />
              </div>
              <div className="modal-footer-row">
                <button type="button" className="btn secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save Snippet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
