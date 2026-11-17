import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { ColumnDefinition, ForeignKeyDefinition, IndexDefinition, QueryResult, TableSchema } from '../types/database';

class DatabaseEngineService {
  private SQL: SqlJsStatic | null = null;
  private databases: Map<string, Database> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.SQL = await initSqlJs({
          locateFile: () => sqlWasmUrl || '/sql-wasm.wasm',
        });
        this.isInitialized = true;
      } catch (err) {
        console.error('Failed to initialize WebAssembly SQLite engine:', err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  public createDatabase(id: string, _name: string, initialSql?: string): Database {
    if (!this.SQL) throw new Error('SQL engine not initialized');

    if (this.databases.has(id)) {
      this.databases.get(id)!.close();
      this.databases.delete(id);
    }

    const db = new this.SQL.Database();
    if (initialSql) {
      db.run(initialSql);
    }
    this.databases.set(id, db);
    return db;
  }

  public async loadFromFile(id: string, file: File): Promise<void> {
    if (!this.SQL) throw new Error('SQL engine not initialized');
    const arrayBuffer = await file.arrayBuffer();
    const uInt8Array = new Uint8Array(arrayBuffer);
    
    if (this.databases.has(id)) {
      this.databases.get(id)!.close();
    }
    const db = new this.SQL.Database(uInt8Array);
    this.databases.set(id, db);
  }

  public exportToFile(id: string): Uint8Array {
    const db = this.getDb(id);
    return db.export();
  }

  public hasDatabase(id: string): boolean {
    return this.databases.has(id);
  }

  public getDb(id: string): Database {
    const db = this.databases.get(id);
    if (!db) {
      if (this.SQL) {
        // Create fresh empty database
        return this.createDatabase(id, 'SQLite Database');
      }
      throw new Error(`Database connection "${id}" not found`);
    }
    return db;
  }

  public execute(id: string, sql: string): QueryResult {
    const startTime = performance.now();
    const now = new Date().toLocaleTimeString();

    try {
      const db = this.getDb(id);
      const res = db.exec(sql);
      const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      if (!res || res.length === 0) {
        // Check affected rows for DDL / DML
        const rowsModified = db.getRowsModified();
        return {
          columns: ['status'],
          values: [['Statement executed successfully.']],
          executionTimeMs,
          rowsAffected: rowsModified,
          timestamp: now,
          sql,
        };
      }

      // Return the result of the last query statement
      const lastResult = res[res.length - 1];
      return {
        columns: lastResult.columns,
        values: lastResult.values,
        executionTimeMs,
        rowsAffected: lastResult.values.length,
        timestamp: now,
        sql,
      };
    } catch (err: any) {
      const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        columns: ['error'],
        values: [],
        executionTimeMs,
        error: err?.message || String(err),
        timestamp: now,
        sql,
      };
    }
  }

  public getTables(id: string): string[] {
    const db = this.getDb(id);
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
    if (!res || res.length === 0) return [];
    return res[0].values.map(v => String(v[0]));
  }

  public getTableSchema(id: string, tableName: string): TableSchema {
    const db = this.getDb(id);
    
    // Columns
    const colsRes = db.exec(`PRAGMA table_info("${tableName}");`);
    const columns: ColumnDefinition[] = [];
    if (colsRes && colsRes.length > 0) {
      for (const row of colsRes[0].values) {
        // cid, name, type, notnull, dflt_value, pk
        columns.push({
          name: String(row[1]),
          type: String(row[2]).toUpperCase() || 'TEXT',
          notNull: Boolean(row[3]),
          defaultValue: row[4] !== null ? String(row[4]) : null,
          primaryKey: Boolean(row[5]),
          autoIncrement: Boolean(row[5]) && String(row[2]).toUpperCase().includes('INT'),
        });
      }
    }

    // Foreign Keys
    const fkRes = db.exec(`PRAGMA foreign_key_list("${tableName}");`);
    const foreignKeys: ForeignKeyDefinition[] = [];
    if (fkRes && fkRes.length > 0) {
      for (const row of fkRes[0].values) {
        // id, seq, table, from, to, on_update, on_delete, match
        foreignKeys.push({
          id: Number(row[0]),
          seq: Number(row[1]),
          table: String(row[2]),
          from: String(row[3]),
          to: String(row[4]),
          onUpdate: String(row[5]),
          onDelete: String(row[6]),
          match: String(row[7]),
        });
      }
    }

    // Indexes
    const idxRes = db.exec(`PRAGMA index_list("${tableName}");`);
    const indexes: IndexDefinition[] = [];
    if (idxRes && idxRes.length > 0) {
      for (const row of idxRes[0].values) {
        // seq, name, unique, origin, partial
        const idxName = String(row[1]);
        const unique = Boolean(row[2]);
        const idxColsRes = db.exec(`PRAGMA index_info("${idxName}");`);
        const idxCols: string[] = [];
        if (idxColsRes && idxColsRes.length > 0) {
          for (const colRow of idxColsRes[0].values) {
            idxCols.push(String(colRow[2]));
          }
        }
        indexes.push({
          name: idxName,
          unique,
          columns: idxCols,
        });
      }
    }

    // Row Count
    let rowCount = 0;
    try {
      const countRes = db.exec(`SELECT COUNT(*) FROM "${tableName}";`);
      if (countRes && countRes.length > 0) {
        rowCount = Number(countRes[0].values[0][0]);
      }
    } catch {
      rowCount = 0;
    }

    return {
      name: tableName,
      columns,
      foreignKeys,
      indexes,
      rowCount,
    };
  }

  public getAllSchemas(id: string): TableSchema[] {
    const tables = this.getTables(id);
    return tables.map(tbl => this.getTableSchema(id, tbl));
  }

  public getTableData(
    id: string,
    tableName: string,
    offset = 0,
    limit = 50,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'ASC',
    filterText?: string,
    whereClause?: string,
    orderByClause?: string
  ): QueryResult {
    let sql = `SELECT * FROM "${tableName}"`;

    if (whereClause && whereClause.trim().length > 0) {
      const cleanWhere = whereClause.trim().replace(/^where\s+/i, '');
      sql += ` WHERE ${cleanWhere}`;
    } else if (filterText && filterText.trim().length > 0) {
      const schema = this.getTableSchema(id, tableName);
      const clauses = schema.columns.map(c => `CAST("${c.name}" AS TEXT) LIKE '%${filterText.replace(/'/g, "''")}%'`);
      if (clauses.length > 0) {
        sql += ` WHERE (${clauses.join(' OR ')})`;
      }
    }

    if (orderByClause && orderByClause.trim().length > 0) {
      const cleanOrder = orderByClause.trim().replace(/^order\s+by\s+/i, '');
      sql += ` ORDER BY ${cleanOrder}`;
    } else if (sortBy) {
      sql += ` ORDER BY "${sortBy}" ${sortOrder}`;
    }

    sql += ` LIMIT ${limit} OFFSET ${offset};`;

    return this.execute(id, sql);
  }

  public getFilteredRowCount(
    id: string,
    tableName: string,
    whereClause?: string
  ): number | null {
    if (!whereClause || !whereClause.trim()) return null;
    try {
      const cleanWhere = whereClause.trim().replace(/^where\s+/i, '');
      const res = this.execute(id, `SELECT COUNT(*) FROM "${tableName}" WHERE ${cleanWhere};`);
      if (res && res.values && res.values[0] && res.values[0][0] !== undefined) {
        return Number(res.values[0][0]);
      }
    } catch {
      return null;
    }
    return null;
  }

  public updateRow(
    id: string,
    tableName: string,
    primaryKeyCol: string,
    primaryKeyValue: any,
    updatedCol: string,
    newValue: any
  ): void {
    const db = this.getDb(id);
    const escapedVal = newValue === null ? 'NULL' : typeof newValue === 'number' ? newValue : `'${String(newValue).replace(/'/g, "''")}'`;
    const pkVal = typeof primaryKeyValue === 'number' ? primaryKeyValue : `'${String(primaryKeyValue).replace(/'/g, "''")}'`;
    db.run(`UPDATE "${tableName}" SET "${updatedCol}" = ${escapedVal} WHERE "${primaryKeyCol}" = ${pkVal};`);
  }

  public insertRow(id: string, tableName: string, rowData: Record<string, any>): void {
    const db = this.getDb(id);
    const cols = Object.keys(rowData);
    const vals = cols.map(c => {
      const v = rowData[c];
      if (v === null || v === undefined || v === '') return 'NULL';
      if (typeof v === 'number') return v;
      return `'${String(v).replace(/'/g, "''")}'`;
    });

    const sql = `INSERT INTO "${tableName}" ("${cols.join('", "')}") VALUES (${vals.join(', ')});`;
    db.run(sql);
  }

  public deleteRow(id: string, tableName: string, primaryKeyCol: string, primaryKeyValue: any): void {
    const db = this.getDb(id);
    const pkVal = typeof primaryKeyValue === 'number' ? primaryKeyValue : `'${String(primaryKeyValue).replace(/'/g, "''")}'`;
    db.run(`DELETE FROM "${tableName}" WHERE "${primaryKeyCol}" = ${pkVal};`);
  }

  public exportTableAsCsv(id: string, tableName: string): string {
    const res = this.execute(id, `SELECT * FROM "${tableName}";`);
    if (!res.columns || res.columns.length === 0) return '';
    
    const lines: string[] = [];
    lines.push(res.columns.map(c => `"${c.replace(/"/g, '""')}"`).join(','));
    for (const row of res.values) {
      lines.push(row.map(val => {
        if (val === null || val === undefined) return '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','));
    }
    return lines.join('\n');
  }

  public exportTableAsJson(id: string, tableName: string): string {
    const res = this.execute(id, `SELECT * FROM "${tableName}";`);
    const objects = res.values.map(row => {
      const obj: Record<string, any> = {};
      res.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    return JSON.stringify(objects, null, 2);
  }

  public exportAsSqlDump(id: string): string {
    const tables = this.getTables(id);
    const dumps: string[] = [
      '-- Nexabase Studio Database Export',
      `-- Generated At: ${new Date().toISOString()}`,
      'PRAGMA foreign_keys=OFF;',
      'BEGIN TRANSACTION;'
    ];

    const db = this.getDb(id);
    for (const table of tables) {
      // DDL
      const ddlRes = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';`);
      if (ddlRes && ddlRes.length > 0 && ddlRes[0].values[0][0]) {
        dumps.push(`\n-- Table: ${table}`);
        dumps.push(`DROP TABLE IF EXISTS "${table}";`);
        dumps.push(`${ddlRes[0].values[0][0]};`);
      }

      // Inserts
      const dataRes = db.exec(`SELECT * FROM "${table}";`);
      if (dataRes && dataRes.length > 0) {
        const cols = dataRes[0].columns;
        for (const row of dataRes[0].values) {
          const vals = row.map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          dumps.push(`INSERT INTO "${table}" ("${cols.join('", "')}") VALUES (${vals.join(', ')});`);
        }
      }
    }

    dumps.push('\nCOMMIT;');
    return dumps.join('\n');
  }
}

export const dbEngine = new DatabaseEngineService();
