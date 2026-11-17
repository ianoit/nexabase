import React, { useState } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  Table as TableIcon, 
  Code, 
  Filter, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import type { TableSchema } from '../types/database';

interface VisualQueryBuilderProps {
  schemas: TableSchema[];
  onExecuteQuery: (sql: string) => void;
}

interface SelectedField {
  table: string;
  column: string;
}

interface WhereCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  connector: 'AND' | 'OR';
}

export const VisualQueryBuilder: React.FC<VisualQueryBuilderProps> = ({
  schemas,
  onExecuteQuery,
}) => {
  const [selectedTables, setSelectedTables] = useState<string[]>(['products', 'categories']);
  const [selectedFields, setSelectedFields] = useState<SelectedField[]>([
    { table: 'products', column: 'title' },
    { table: 'categories', column: 'name' },
    { table: 'products', column: 'price' },
    { table: 'products', column: 'stock_quantity' },
  ]);
  const [conditions, setConditions] = useState<WhereCondition[]>([
    { id: '1', field: 'products.price', operator: '>', value: '100', connector: 'AND' },
    { id: '2', field: 'products.stock_quantity', operator: '>', value: '5', connector: 'AND' },
  ]);
  const [orderByField, setOrderByField] = useState<string>('products.price');
  const [orderDir, setOrderDir] = useState<'ASC' | 'DESC'>('DESC');
  const [limit, setLimit] = useState<number>(20);

  const toggleField = (table: string, column: string) => {
    const exists = selectedFields.some(f => f.table === table && f.column === column);
    if (exists) {
      setSelectedFields(prev => prev.filter(f => !(f.table === table && f.column === column)));
    } else {
      setSelectedFields(prev => [...prev, { table, column }]);
    }
  };

  const addCondition = () => {
    const defaultField = selectedFields[0] ? `${selectedFields[0].table}.${selectedFields[0].column}` : 'products.price';
    setConditions(prev => [
      ...prev,
      {
        id: `cond-${Date.now()}`,
        field: defaultField,
        operator: '=',
        value: '',
        connector: 'AND',
      },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, patch: Partial<WhereCondition>) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  // Generate SQL statement in real-time
  const generateSql = () => {
    if (selectedTables.length === 0) return '-- Please select at least one table above.';

    // SELECT
    const selectClause = selectedFields.length > 0
      ? selectedFields.map(f => `  ${f.table}.${f.column}`).join(',\n')
      : '  *';

    // FROM & JOIN
    const primaryTable = selectedTables[0];
    let fromClause = `FROM ${primaryTable}`;

    if (selectedTables.length > 1) {
      for (let i = 1; i < selectedTables.length; i++) {
        const t = selectedTables[i];
        // Look for foreign key relationship
        const srcSchema = schemas.find(s => s.name === primaryTable);
        const fk = srcSchema?.foreignKeys?.find(k => k.table === t);
        if (fk) {
          fromClause += `\nJOIN ${t} ON ${primaryTable}.${fk.from} = ${t}.${fk.to}`;
        } else {
          // Fallback or generic join
          fromClause += `\nJOIN ${t} ON 1=1`;
        }
      }
    }

    // WHERE
    let whereClause = '';
    const validConds = conditions.filter(c => c.value.trim() !== '');
    if (validConds.length > 0) {
      const parts = validConds.map((c, i) => {
        const valStr = isNaN(Number(c.value)) ? `'${c.value.replace(/'/g, "''")}'` : c.value;
        const expr = `${c.field} ${c.operator} ${valStr}`;
        return i === 0 ? `WHERE ${expr}` : `  ${c.connector} ${expr}`;
      });
      whereClause = '\n' + parts.join('\n');
    }

    // ORDER BY
    const orderClause = orderByField ? `\nORDER BY ${orderByField} ${orderDir}` : '';

    // LIMIT
    const limitClause = limit ? `\nLIMIT ${limit};` : ';';

    return `SELECT\n${selectClause}\n${fromClause}${whereClause}${orderClause}${limitClause}`;
  };

  const sqlOutput = generateSql();

  return (
    <div className="visual-query-builder-container">
      {/* Top Bar */}
      <div className="builder-top-bar">
        <div className="builder-title-group">
          <Code size={16} className="text-cyan" />
          <h4>Visual Query Designer</h4>
        </div>

        <div className="builder-top-actions">
          <button 
            className="action-btn-sm primary"
            onClick={() => onExecuteQuery(sqlOutput)}
          >
            <Play size={13} />
            <span>Open & Run in Query Editor</span>
          </button>
        </div>
      </div>

      {/* Main Split: Tables Selection Cards & Options */}
      <div className="builder-middle-viewport">
        {/* Available Tables & Columns Grid */}
        <div className="tables-canvas-row">
          {schemas.map(schema => {
            const isTableSelected = selectedTables.includes(schema.name);

            return (
              <div 
                key={schema.name} 
                className={`builder-table-box ${isTableSelected ? 'active' : ''}`}
              >
                <div 
                  className="table-box-header"
                  onClick={() => {
                    if (isTableSelected) {
                      if (selectedTables.length > 1) {
                        setSelectedTables(prev => prev.filter(t => t !== schema.name));
                        setSelectedFields(prev => prev.filter(f => f.table !== schema.name));
                      }
                    } else {
                      setSelectedTables(prev => [...prev, schema.name]);
                    }
                  }}
                >
                  <TableIcon size={13} className="text-cyan" />
                  <strong>{schema.name}</strong>
                  <span className="box-col-count">{schema.columns.length} cols</span>
                </div>

                <div className="table-box-columns-list">
                  {schema.columns.map(col => {
                    const isChecked = selectedFields.some(
                      f => f.table === schema.name && f.column === col.name
                    );

                    return (
                      <div 
                        key={col.name} 
                        className={`col-pick-row ${isChecked ? 'picked' : ''}`}
                        onClick={() => toggleField(schema.name, col.name)}
                      >
                        {isChecked ? (
                          <CheckSquare size={13} className="chk-icon text-cyan" />
                        ) : (
                          <Square size={13} className="chk-icon text-muted" />
                        )}
                        <span className="col-pick-name">{col.name}</span>
                        <span className="col-pick-type">{col.type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Query Clauses Config: WHERE, ORDER BY, LIMIT */}
        <div className="query-clauses-box">
          <div className="clause-section">
            <div className="clause-header">
              <Filter size={13} className="text-cyan" />
              <strong>WHERE Criteria Conditions</strong>
              <button className="add-cond-btn" onClick={addCondition}>
                <Plus size={12} /> Add Condition
              </button>
            </div>

            <div className="conditions-table">
              {conditions.map((cond, idx) => (
                <div key={cond.id} className="condition-row">
                  {idx > 0 && (
                    <select 
                      value={cond.connector}
                      onChange={e => updateCondition(cond.id, { connector: e.target.value as 'AND' | 'OR' })}
                      className="cond-connector-select"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  <input 
                    type="text" 
                    value={cond.field}
                    onChange={e => updateCondition(cond.id, { field: e.target.value })}
                    placeholder="table.column"
                    className="cond-field-input"
                  />
                  <select 
                    value={cond.operator}
                    onChange={e => updateCondition(cond.id, { operator: e.target.value })}
                    className="cond-op-select"
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                    <option value="LIKE">LIKE</option>
                    <option value="IN">IN</option>
                    <option value="IS NULL">IS NULL</option>
                  </select>
                  <input 
                    type="text" 
                    value={cond.value}
                    onChange={e => updateCondition(cond.id, { value: e.target.value })}
                    placeholder="value..."
                    className="cond-val-input"
                  />
                  <button className="cond-del-btn" onClick={() => removeCondition(cond.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="clause-section row-layout">
            <div className="sort-group">
              <label>ORDER BY</label>
              <input 
                type="text" 
                value={orderByField}
                onChange={e => setOrderByField(e.target.value)}
                className="sort-input"
              />
              <select 
                value={orderDir}
                onChange={e => setOrderDir(e.target.value as 'ASC' | 'DESC')}
                className="sort-select"
              >
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </select>
            </div>

            <div className="limit-group">
              <label>LIMIT</label>
              <input 
                type="number" 
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="limit-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom SQL Output Pane */}
      <div className="builder-sql-preview">
        <div className="preview-label">
          <span>Real-time Generated SQL Query</span>
        </div>
        <pre className="builder-code-output">{sqlOutput}</pre>
      </div>
    </div>
  );
};
