import React, { useState } from 'react';
import { 
  Play, 
  Sparkles, 
  RotateCcw, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  Code2, 
  Clock, 
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';
import { dbGateway } from '../services/dbGateway';
import type { QueryResult, DatabaseConnection } from '../types/database';

interface QueryEditorProps {
  connectionId: string;
  initialSql?: string;
  onRefreshSchemas?: () => void;
  activeConnection?: DatabaseConnection | null;
}

const PREMADE_SNIPPETS = [
  {
    name: 'Top Selling Products by Revenue',
    sql: `SELECT 
  p.id AS product_id,
  p.title AS product_name,
  c.name AS category_name,
  p.price,
  SUM(oi.quantity) AS total_units_sold,
  ROUND(SUM(oi.subtotal), 2) AS total_revenue
FROM products p
JOIN categories c ON p.category_id = c.id
JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id
ORDER BY total_revenue DESC;`,
  },
  {
    name: 'Customer Order History & Loyalty Analysis',
    sql: `SELECT 
  c.id,
  c.first_name || ' ' || c.last_name AS full_name,
  c.email,
  c.city,
  c.loyalty_points,
  COUNT(o.id) AS total_orders,
  ROUND(SUM(o.total_amount), 2) AS lifetime_spent
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id
ORDER BY lifetime_spent DESC;`,
  },
  {
    name: 'Inventory Health & Reorder Alert',
    sql: `SELECT 
  p.sku,
  p.title,
  c.name AS category,
  p.stock_quantity,
  p.price,
  CASE 
    WHEN p.stock_quantity <= 15 THEN 'CRITICAL REORDER'
    WHEN p.stock_quantity <= 30 THEN 'LOW STOCK'
    ELSE 'HEALTHY'
  END AS inventory_status
FROM products p
JOIN categories c ON p.category_id = c.id
ORDER BY p.stock_quantity ASC;`,
  },
  {
    name: 'Recent Reviews with Product Details',
    sql: `SELECT 
  r.id,
  r.rating || ' ★' AS score,
  r.title AS review_title,
  r.comment,
  p.title AS product_name,
  c.first_name || ' ' || SUBSTR(c.last_name, 1, 1) || '.' AS reviewer
FROM reviews r
JOIN products p ON r.product_id = p.id
JOIN customers c ON r.customer_id = c.id
ORDER BY r.rating DESC;`,
  },
];

export const QueryEditor: React.FC<QueryEditorProps> = ({
  connectionId,
  initialSql = 'SELECT * FROM products LIMIT 10;',
  onRefreshSchemas,
  activeConnection,
}) => {
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'grid' | 'history' | 'explain'>('grid');
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
  const [copied, setCopied] = useState(false);

  const handleRunQuery = async () => {
    if (!sql.trim()) return;

    if (activeConnection && activeConnection.engine !== 'sqlite') {
      try {
        const res = await dbGateway.executeQuery(activeConnection, sql);
        setResult(res);
        setQueryHistory(prev => [res, ...prev.slice(0, 19)]);
        setActiveResultTab('grid');
        if (onRefreshSchemas && (sql.toUpperCase().includes('CREATE') || sql.toUpperCase().includes('DROP') || sql.toUpperCase().includes('ALTER'))) {
          onRefreshSchemas();
        }
      } catch (err: any) {
        setResult({
          columns: [],
          values: [],
          error: err.message || 'Remote query failed',
          executionTimeMs: 0,
          timestamp: new Date().toLocaleTimeString(),
          sql,
        });
      }
      return;
    }

    const res = dbEngine.execute(connectionId, sql);
    setResult(res);
    setQueryHistory(prev => [res, ...prev.slice(0, 19)]);
    setActiveResultTab('grid');
    if (onRefreshSchemas && (sql.toUpperCase().includes('CREATE') || sql.toUpperCase().includes('DROP') || sql.toUpperCase().includes('ALTER'))) {
      onRefreshSchemas();
    }
  };

  const handleExplainPlan = async () => {
    if (!sql.trim()) return;
    const explainSql = activeConnection?.engine === 'postgres' ? `EXPLAIN ${sql}` : `EXPLAIN QUERY PLAN ${sql}`;
    if (activeConnection && activeConnection.engine !== 'sqlite') {
      try {
        const res = await dbGateway.executeQuery(activeConnection, explainSql);
        setResult(res);
        setActiveResultTab('grid');
      } catch (err: any) {
        setResult({
          columns: [],
          values: [],
          error: err.message || 'EXPLAIN failed',
          executionTimeMs: 0,
          timestamp: new Date().toLocaleTimeString(),
          sql: explainSql,
        });
      }
      return;
    }
    const res = dbEngine.execute(connectionId, explainSql);
    setResult(res);
    setActiveResultTab('grid');
  };

  const handleFormatSql = () => {
    // Basic smart SQL formatting
    const formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .trim();
    setSql(formatted);
  };

  const handleCopyResults = () => {
    if (!result || !result.columns) return;
    const tsv = [
      result.columns.join('\t'),
      ...result.values.map(r => r.join('\t')),
    ].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="query-editor-container">
      {/* Editor Action Toolbar */}
      <div className="editor-toolbar">
        <button 
          className="run-query-btn" 
          onClick={handleRunQuery}
          title="Execute Query (Ctrl/Cmd + Enter)"
        >
          <Play size={14} className="play-icon" />
          <span>Run (Cmd+Enter)</span>
        </button>

        <button 
          className="editor-btn" 
          onClick={handleExplainPlan}
          title="Explain Query Execution Plan (nav_query_plan_cache)"
        >
          <Layers size={13} />
          <span>Explain Plan</span>
        </button>

        <button 
          className="editor-btn" 
          onClick={handleFormatSql}
          title="Beautify / Format SQL Indentation"
        >
          <Sparkles size={13} />
          <span>Beautify</span>
        </button>

        <button 
          className="editor-btn" 
          onClick={() => setSql('')}
          title="Clear Editor"
        >
          <RotateCcw size={13} />
          <span>Clear</span>
        </button>

        <div className="toolbar-spacer"></div>

        {/* Snippet Selector */}
        <div className="snippet-selector">
          <Code2 size={13} className="snippet-icon" />
          <select 
            onChange={(e) => {
              if (e.target.value) {
                setSql(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="snippet-dropdown"
          >
            <option value="" disabled>Load SQL Snippet...</option>
            {PREMADE_SNIPPETS.map(s => (
              <option key={s.name} value={s.sql}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SQL Textarea */}
      <div className="editor-textarea-wrapper">
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleRunQuery();
            }
          }}
          placeholder="Enter your SQL statement here (e.g. SELECT * FROM customers;)..."
          className="sql-code-editor"
          spellCheck={false}
        />
      </div>

      {/* Results Section */}
      <div className="query-results-panel">
        {/* Results Header Tabs */}
        <div className="results-header-tabs">
          <div className="left-tabs">
            <button 
              className={`res-tab ${activeResultTab === 'grid' ? 'active' : ''}`}
              onClick={() => setActiveResultTab('grid')}
            >
              <span>Result Grid</span>
              {result && !result.error && (
                <span className="res-badge">{result.values.length} rows</span>
              )}
            </button>
            <button 
              className={`res-tab ${activeResultTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveResultTab('history')}
            >
              <History size={13} />
              <span>Query History ({queryHistory.length})</span>
            </button>
          </div>

          {result && (
            <div className="result-stats-bar">
              {result.error ? (
                <div className="status-indicator error">
                  <AlertTriangle size={13} />
                  <span>Execution Failed</span>
                </div>
              ) : (
                <div className="status-indicator success">
                  <CheckCircle2 size={13} />
                  <span>Success</span>
                </div>
              )}
              <span className="stat-item">
                <Clock size={12} />
                <span>{result.executionTimeMs} ms</span>
              </span>
              <span className="stat-item">
                <span>{result.rowsAffected ?? result.values.length} records affected</span>
              </span>
              <button 
                className="btn-copy-results" 
                onClick={handleCopyResults}
                title="Copy Results as TSV"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied!' : 'Copy TSV'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Results Body */}
        <div className="results-body-viewport">
          {activeResultTab === 'grid' && (
            <>
              {result?.error ? (
                <div className="query-error-banner">
                  <AlertTriangle size={18} className="err-icon" />
                  <div className="err-content">
                    <h4>SQL Execution Error</h4>
                    <pre>{result.error}</pre>
                  </div>
                </div>
              ) : result ? (
                <div className="result-table-wrapper">
                  <table className="result-table">
                    <thead>
                      <tr>
                        <th className="r-th-num">#</th>
                        {result.columns.map(col => (
                          <th key={col} className="r-th">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.values.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="r-td-num">{rIdx + 1}</td>
                          {row.map((val, cIdx) => (
                            <td key={cIdx} className={val === null ? 'null-val' : ''}>
                              {val === null ? 'NULL' : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-results-prompt">
                  <Code2 size={32} className="dim-icon" />
                  <p>Execute your query with <strong>Cmd + Enter</strong> or choose a snippet above to view results.</p>
                </div>
              )}
            </>
          )}

          {activeResultTab === 'history' && (
            <div className="history-list">
              {queryHistory.length === 0 ? (
                <div className="empty-results-prompt">No query executions recorded yet.</div>
              ) : (
                queryHistory.map((item, idx) => (
                  <div key={idx} className="history-item">
                    <div className="hist-header">
                      <span className={`hist-badge ${item.error ? 'err' : 'ok'}`}>
                        {item.error ? 'FAILED' : `${item.values.length} rows`}
                      </span>
                      <span className="hist-time">{item.timestamp} ({item.executionTimeMs} ms)</span>
                      <button 
                        className="hist-replay-btn" 
                        onClick={() => { setSql(item.sql); handleRunQuery(); }}
                      >
                        Re-run
                      </button>
                    </div>
                    <pre className="hist-sql">{item.sql}</pre>
                    {item.error && <p className="hist-err-msg">{item.error}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
