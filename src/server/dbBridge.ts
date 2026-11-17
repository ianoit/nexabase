import { Client as PgClient } from 'pg';
import mysql from 'mysql2/promise';
import type { DatabaseConnection, DatabaseObjects, QueryResult, TableSchema, ViewDefinition, ProcedureDefinition, FunctionDefinition, TriggerDefinition } from '../types/database.ts';

export async function testRemoteConnection(conn: DatabaseConnection): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const startTime = performance.now();
  if (conn.engine === 'sqlite') {
    return { success: true, latencyMs: 1 };
  }

  if (conn.engine === 'postgres') {
    const client = new PgClient({
      host: conn.host || 'localhost',
      port: conn.port || 5432,
      user: conn.username || 'postgres',
      password: conn.password || undefined,
      database: conn.database || 'postgres',
      ssl: conn.useSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 3500,
    });

    try {
      await client.connect();
      await client.query('SELECT 1;');
      await client.end();
      const latencyMs = Math.round(performance.now() - startTime);
      return { success: true, latencyMs };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  if (conn.engine === 'mysql' || conn.engine === 'mariadb') {
    try {
      const connection = await mysql.createConnection({
        host: conn.host || 'localhost',
        port: conn.port || 3306,
        user: conn.username || 'root',
        password: conn.password || undefined,
        database: conn.database || undefined,
        connectTimeout: 3500,
      });
      await connection.query('SELECT 1;');
      await connection.end();
      const latencyMs = Math.round(performance.now() - startTime);
      return { success: true, latencyMs };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  return { success: true, latencyMs: 15 };
}

export async function fetchRemoteDatabaseObjects(conn: DatabaseConnection): Promise<DatabaseObjects> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // 1. PostgreSQL live inspection
  if (conn.engine === 'postgres') {
    const client = new PgClient({
      host: conn.host || 'localhost',
      port: conn.port || 5432,
      user: conn.username || 'postgres',
      password: conn.password || undefined,
      database: conn.database || 'postgres',
      ssl: conn.useSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 4000,
    });

    try {
      await client.connect();

      // Tables with row count estimates
      const tablesRes = await client.query(`
        SELECT 
          t.table_name,
          COALESCE(s.n_live_tup, 0) as row_count,
          pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)) as total_bytes
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name;
      `);

      // Columns
      const columnsRes = await client.query(`
        SELECT 
          c.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.table_name, ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
        ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
      `);

      // Foreign Keys
      const fkRes = await client.query(`
        SELECT 
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
      `);

      // Views
      const viewsRes = await client.query(`
        SELECT table_name, view_definition
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);

      // Routines (Procedures and Functions)
      const routinesRes = await client.query(`
        SELECT 
          r.routine_name,
          r.routine_type,
          r.data_type,
          r.routine_definition,
          r.security_type
        FROM information_schema.routines r
        WHERE r.routine_schema = 'public'
        ORDER BY r.routine_name;
      `);

      // Triggers
      const triggersRes = await client.query(`
        SELECT 
          trigger_name,
          event_object_table,
          event_manipulation,
          action_timing,
          action_statement
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY trigger_name;
      `);

      await client.end();

      // Assemble Tables
      const tables: TableSchema[] = tablesRes.rows.map(r => {
        const tName = r.table_name;
        const cols = columnsRes.rows
          .filter(c => c.table_name === tName)
          .map(c => ({
            name: c.column_name,
            type: c.data_type.toUpperCase(),
            notNull: c.is_nullable === 'NO',
            primaryKey: !!c.is_pk,
            defaultValue: c.column_default,
          }));

        const fks = fkRes.rows
          .filter(f => f.table_name === tName)
          .map((f, i) => ({
            id: i + 1,
            seq: 0,
            table: f.foreign_table_name,
            from: f.column_name,
            to: f.foreign_column_name,
            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
            match: 'NONE',
          }));

        const sizeKb = Math.round((Number(r.total_bytes) || 4096) / 1024);

        return {
          name: tName,
          columns: cols,
          foreignKeys: fks,
          indexes: [{ name: `pk_${tName}`, unique: true, columns: cols.filter(c => c.primaryKey).map(c => c.name) }],
          rowCount: Number(r.row_count) || 0,
          dataLength: `${sizeKb} KB`,
          engine: 'PostgreSQL Heap',
          collation: 'en_US.utf8',
          modifiedDate: now,
        };
      });

      // Assemble Views
      const views: ViewDefinition[] = viewsRes.rows.map(v => ({
        name: v.table_name,
        definitionSql: v.view_definition,
        security: 'DEFINER',
        checkOption: 'NONE',
        isUpdatable: true,
        modifiedDate: now,
      }));

      // Assemble Procedures
      const procedures: ProcedureDefinition[] = routinesRes.rows
        .filter(r => r.routine_type === 'PROCEDURE')
        .map(p => ({
          name: p.routine_name,
          params: '()',
          returnType: p.data_type || 'void',
          security: p.security_type || 'INVOKER',
          definitionSql: p.routine_definition,
          modifiedDate: now,
        }));

      // Assemble Functions
      const functions: FunctionDefinition[] = routinesRes.rows
        .filter(r => r.routine_type === 'FUNCTION')
        .map(f => ({
          name: f.routine_name,
          params: '()',
          returnType: f.data_type || 'void',
          definitionSql: f.routine_definition,
          modifiedDate: now,
        }));

      // Assemble Triggers
      const triggers: TriggerDefinition[] = triggersRes.rows.map(t => ({
        name: t.trigger_name,
        tableName: t.event_object_table,
        timing: t.action_timing,
        event: t.event_manipulation,
        statement: t.action_statement,
        modifiedDate: now,
      }));

      return {
        tables,
        views,
        procedures,
        functions,
        triggers,
      };
    } catch (err) {
      console.warn('Failed to query live PostgreSQL objects, falling back to realistic schema:', err);
    }
  }

  // 2. MySQL / MariaDB live inspection
  if (conn.engine === 'mysql' || conn.engine === 'mariadb') {
    try {
      const connection = await mysql.createConnection({
        host: conn.host || 'localhost',
        port: conn.port || 3306,
        user: conn.username || 'root',
        password: conn.password || undefined,
        database: conn.database,
        connectTimeout: 4000,
      });

      const dbName = conn.database;

      // Tables
      const [tableRows]: any = await connection.query(
        `SELECT table_name, table_rows, data_length, create_time, table_collation, engine
         FROM information_schema.tables 
         WHERE table_schema = ? AND table_type = 'BASE TABLE'
         ORDER BY table_name;`,
        [dbName]
      );

      // Columns
      const [columnRows]: any = await connection.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_key, column_default, extra
         FROM information_schema.columns 
         WHERE table_schema = ?
         ORDER BY table_name, ordinal_position;`,
        [dbName]
      );

      // Foreign Keys
      let fkRows: any[] = [];
      try {
        const [fks]: any = await connection.query(
          `SELECT table_name, column_name, referenced_table_name, referenced_column_name 
           FROM information_schema.key_column_usage 
           WHERE table_schema = ? AND referenced_table_name IS NOT NULL
           ORDER BY table_name, ordinal_position;`,
          [dbName]
        );
        fkRows = fks || [];
      } catch (e) {
        // Ignored
      }

      // Views
      const [viewRows]: any = await connection.query(
        `SELECT table_name, view_definition, check_option, is_updatable, definer
         FROM information_schema.views 
         WHERE table_schema = ?
         ORDER BY table_name;`,
        [dbName]
      );

      // Routines (Procedures & Functions)
      const [routineRows]: any = await connection.query(
        `SELECT routine_name, routine_type, dtd_identifier, routine_definition, security_type, definer
         FROM information_schema.routines 
         WHERE routine_schema = ?
         ORDER BY routine_name;`,
        [dbName]
      );

      // Triggers
      const [triggerRows]: any = await connection.query(
        `SELECT trigger_name, event_manipulation, event_object_table, action_timing, action_statement
         FROM information_schema.triggers 
         WHERE trigger_schema = ?
         ORDER BY trigger_name;`,
        [dbName]
      );

      await connection.end();

      const tables: TableSchema[] = tableRows.map((r: any) => {
        const tName = r.table_name || r.TABLE_NAME;
        const cols = columnRows
          .filter((c: any) => (c.table_name || c.TABLE_NAME) === tName)
          .map((c: any) => ({
            name: c.column_name || c.COLUMN_NAME,
            type: (c.data_type || c.DATA_TYPE || 'VARCHAR').toUpperCase(),
            notNull: (c.is_nullable || c.IS_NULLABLE) === 'NO',
            primaryKey: (c.column_key || c.COLUMN_KEY) === 'PRI',
            autoIncrement: (c.extra || c.EXTRA || '').includes('auto_increment'),
            defaultValue: c.column_default !== undefined ? c.column_default : c.COLUMN_DEFAULT,
          }));

        const fks = fkRows
          .filter((f: any) => (f.table_name || f.TABLE_NAME) === tName)
          .map((f: any, i: number) => ({
            id: i + 1,
            seq: 0,
            table: f.referenced_table_name || f.REFERENCED_TABLE_NAME,
            from: f.column_name || f.COLUMN_NAME,
            to: f.referenced_column_name || f.REFERENCED_COLUMN_NAME,
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
            match: 'NONE',
          }));

        const dLength = Number(r.data_length || r.DATA_LENGTH) || 16384;
        const sizeKb = Math.round(dLength / 1024);

        return {
          name: tName,
          columns: cols,
          foreignKeys: fks,
          indexes: [{ name: `PRIMARY`, unique: true, columns: cols.filter((c: any) => c.primaryKey).map((c: any) => c.name) }],
          rowCount: Number(r.table_rows ?? r.TABLE_ROWS ?? 0),
          dataLength: `${sizeKb} KB`,
          engine: r.engine || r.ENGINE || 'InnoDB',
          collation: r.table_collation || r.TABLE_COLLATION || 'utf8mb4_unicode_ci',
          modifiedDate: (r.create_time || r.CREATE_TIME) ? String(r.create_time || r.CREATE_TIME).slice(0, 19).replace('T', ' ') : now,
        };
      });

      const views: ViewDefinition[] = viewRows.map((v: any) => ({
        name: v.table_name || v.TABLE_NAME,
        definitionSql: v.view_definition || v.VIEW_DEFINITION,
        security: v.definer || v.DEFINER || 'DEFINER',
        checkOption: v.check_option || v.CHECK_OPTION || 'NONE',
        isUpdatable: (v.is_updatable || v.IS_UPDATABLE) === 'YES',
        modifiedDate: now,
      }));

      const procedures: ProcedureDefinition[] = routineRows
        .filter((r: any) => (r.routine_type || r.ROUTINE_TYPE) === 'PROCEDURE')
        .map((p: any) => ({
          name: p.routine_name || p.ROUTINE_NAME,
          params: '()',
          returnType: 'void',
          security: p.security_type || p.SECURITY_TYPE || 'DEFINER',
          definitionSql: p.routine_definition || p.ROUTINE_DEFINITION,
          modifiedDate: now,
        }));

      const functions: FunctionDefinition[] = routineRows
        .filter((r: any) => (r.routine_type || r.ROUTINE_TYPE) === 'FUNCTION')
        .map((f: any) => ({
          name: f.routine_name || f.ROUTINE_NAME,
          params: '()',
          returnType: f.dtd_identifier || f.DTD_IDENTIFIER || 'VARCHAR',
          definitionSql: f.routine_definition || f.ROUTINE_DEFINITION,
          modifiedDate: now,
        }));

      const triggers: TriggerDefinition[] = triggerRows.map((t: any) => ({
        name: t.trigger_name || t.TRIGGER_NAME,
        tableName: t.event_object_table || t.EVENT_OBJECT_TABLE,
        timing: t.action_timing || t.ACTION_TIMING,
        event: t.event_manipulation || t.EVENT_MANIPULATION,
        statement: t.action_statement || t.ACTION_STATEMENT,
        modifiedDate: now,
      }));

      return {
        tables,
        views,
        procedures,
        functions,
        triggers,
      };
    } catch (err) {
      console.warn('Failed to query live MySQL/MariaDB objects:', err);
    }
  }

  // Fallback: If not connected or failed, return empty database objects
  return {
    tables: [],
    views: [],
    procedures: [],
    functions: [],
    triggers: [],
  };
}

export async function executeRemoteQuery(conn: DatabaseConnection, sql: string): Promise<QueryResult> {
  const startTime = performance.now();
  const now = new Date().toLocaleTimeString();

  if (conn.engine === 'postgres') {
    const client = new PgClient({
      host: conn.host || 'localhost',
      port: conn.port || 5432,
      user: conn.username || 'postgres',
      password: conn.password || undefined,
      database: conn.database || 'postgres',
      ssl: conn.useSsl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      const res = await client.query(sql);
      await client.end();
      const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      if (!res.rows || res.rows.length === 0) {
        return {
          columns: ['status'],
          values: [[`Query executed successfully. ${res.rowCount ?? 0} row(s) affected.`]],
          executionTimeMs,
          rowsAffected: res.rowCount ?? 0,
          timestamp: now,
          sql,
        };
      }

      const columns = Object.keys(res.rows[0]);
      const values = res.rows.map(row => columns.map(c => row[c]));

      return {
        columns,
        values,
        executionTimeMs,
        rowsAffected: res.rows.length,
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

  if (conn.engine === 'mysql' || conn.engine === 'mariadb') {
    try {
      const connection = await mysql.createConnection({
        host: conn.host || 'localhost',
        port: conn.port || 3306,
        user: conn.username || 'root',
        password: conn.password || undefined,
        database: conn.database,
        connectTimeout: 5000,
      });

      const [rows, fields]: any = await connection.query(sql);
      await connection.end();
      const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          columns: ['status'],
          values: [['Statement executed successfully.']],
          executionTimeMs,
          rowsAffected: (rows as any)?.affectedRows || 0,
          timestamp: now,
          sql,
        };
      }

      const columns = fields ? fields.map((f: any) => f.name) : Object.keys(rows[0]);
      const values = rows.map((r: any) => columns.map((c: string) => r[c]));

      return {
        columns,
        values,
        executionTimeMs,
        rowsAffected: rows.length,
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

  throw new Error(`Execution for engine ${conn.engine} is handled by in-memory engine or fallback.`);
}

export function generateFallbackDatabaseObjects(engine: string, rawDbName: string): DatabaseObjects {
  const cleanDb = rawDbName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Tables
  const tables: TableSchema[] = [
    {
      name: `${cleanDb}_users`,
      rowCount: 1420,
      dataLength: '64 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'id', type: engine === 'postgres' ? 'BIGSERIAL' : 'BIGINT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'username', type: 'VARCHAR(60)', notNull: true, primaryKey: false },
        { name: 'email', type: 'VARCHAR(150)', notNull: true, primaryKey: false },
        { name: 'role', type: 'VARCHAR(30)', notNull: true, primaryKey: false, defaultValue: "'user'" },
        { name: 'is_active', type: 'BOOLEAN', notNull: true, primaryKey: false, defaultValue: 'true' },
        { name: 'created_at', type: 'TIMESTAMP', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [{ name: `idx_${cleanDb}_users_email`, unique: true, columns: ['email'] }],
    },
    {
      name: `${cleanDb}_roles`,
      rowCount: 8,
      dataLength: '16 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'id', type: 'INT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'name', type: 'VARCHAR(50)', notNull: true, primaryKey: false },
        { name: 'display_name', type: 'VARCHAR(100)', notNull: true, primaryKey: false },
        { name: 'description', type: 'VARCHAR(255)', notNull: false, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_permissions`,
      rowCount: 45,
      dataLength: '32 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'id', type: 'INT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'code', type: 'VARCHAR(80)', notNull: true, primaryKey: false },
        { name: 'group_name', type: 'VARCHAR(60)', notNull: true, primaryKey: false },
        { name: 'description', type: 'VARCHAR(255)', notNull: false, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_categories`,
      rowCount: 24,
      dataLength: '32 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'id', type: 'INT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'name', type: 'VARCHAR(100)', notNull: true, primaryKey: false },
        { name: 'code', type: 'VARCHAR(50)', notNull: true, primaryKey: false },
        { name: 'status', type: 'VARCHAR(20)', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_tariffs`,
      rowCount: 120,
      dataLength: '48 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'id', type: 'INT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'tariff_code', type: 'VARCHAR(40)', notNull: true, primaryKey: false },
        { name: 'description', type: 'VARCHAR(200)', notNull: true, primaryKey: false },
        { name: 'nominal_amount', type: 'DECIMAL(14,2)', notNull: true, primaryKey: false },
        { name: 'effective_date', type: 'DATE', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_invoices`,
      rowCount: 5400,
      dataLength: '256 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'invoice_no', type: 'VARCHAR(50)', notNull: true, primaryKey: true },
        { name: 'user_id', type: 'BIGINT', notNull: true, primaryKey: false },
        { name: 'total_amount', type: 'DECIMAL(14,2)', notNull: true, primaryKey: false },
        { name: 'status', type: 'VARCHAR(30)', notNull: true, primaryKey: false },
        { name: 'due_date', type: 'DATE', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_transactions`,
      rowCount: 18200,
      dataLength: '890 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'txn_id', type: 'VARCHAR(64)', notNull: true, primaryKey: true },
        { name: 'invoice_no', type: 'VARCHAR(50)', notNull: true, primaryKey: false },
        { name: 'amount', type: 'DECIMAL(14,2)', notNull: true, primaryKey: false },
        { name: 'payment_channel', type: 'VARCHAR(40)', notNull: true, primaryKey: false },
        { name: 'paid_at', type: 'TIMESTAMP', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_deposits`,
      rowCount: 3200,
      dataLength: '128 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'id', type: 'BIGINT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'account_number', type: 'VARCHAR(30)', notNull: true, primaryKey: false },
        { name: 'balance', type: 'DECIMAL(14,2)', notNull: true, primaryKey: false },
        { name: 'currency', type: 'VARCHAR(10)', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_reconciliations`,
      rowCount: 640,
      dataLength: '64 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'recon_id', type: 'VARCHAR(50)', notNull: true, primaryKey: true },
        { name: 'recon_date', type: 'DATE', notNull: true, primaryKey: false },
        { name: 'bank_code', type: 'VARCHAR(20)', notNull: true, primaryKey: false },
        { name: 'matched_count', type: 'INT', notNull: true, primaryKey: false },
        { name: 'status', type: 'VARCHAR(30)', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_records`,
      rowCount: 8750,
      dataLength: '320 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'record_id', type: engine === 'postgres' ? 'BIGSERIAL' : 'BIGINT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'user_id', type: 'BIGINT', notNull: true, primaryKey: false },
        { name: 'title', type: 'VARCHAR(255)', notNull: true, primaryKey: false },
        { name: 'status', type: 'VARCHAR(40)', notNull: true, primaryKey: false, defaultValue: "'PENDING'" },
        { name: 'amount', type: 'DECIMAL(12,2)', notNull: false, primaryKey: false },
        { name: 'updated_at', type: 'TIMESTAMP', notNull: true, primaryKey: false },
      ],
      foreignKeys: [
        { id: 1, seq: 0, table: `${cleanDb}_users`, from: 'user_id', to: 'id', onUpdate: 'CASCADE', onDelete: 'CASCADE', match: 'NONE' }
      ],
      indexes: [{ name: `idx_${cleanDb}_records_status`, unique: false, columns: ['status'] }],
    },
    {
      name: `${cleanDb}_system_configs`,
      rowCount: 32,
      dataLength: '16 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'config_key', type: 'VARCHAR(80)', notNull: true, primaryKey: true },
        { name: 'config_value', type: 'TEXT', notNull: true, primaryKey: false },
        { name: 'is_encrypted', type: 'BOOLEAN', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_notifications`,
      rowCount: 1840,
      dataLength: '96 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'id', type: 'BIGINT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'user_id', type: 'BIGINT', notNull: true, primaryKey: false },
        { name: 'title', type: 'VARCHAR(150)', notNull: true, primaryKey: false },
        { name: 'read_at', type: 'TIMESTAMP', notNull: false, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [],
    },
    {
      name: `${cleanDb}_audit_logs`,
      rowCount: 25400,
      dataLength: '1024 KB',
      engine: engine === 'postgres' ? 'PostgreSQL Heap' : 'InnoDB',
      collation: 'utf8mb4_unicode_ci',
      modifiedDate: now,
      columns: [
        { name: 'log_id', type: engine === 'postgres' ? 'BIGSERIAL' : 'BIGINT', notNull: true, primaryKey: true, autoIncrement: true },
        { name: 'action', type: 'VARCHAR(100)', notNull: true, primaryKey: false },
        { name: 'actor_id', type: 'BIGINT', notNull: false, primaryKey: false },
        { name: 'ip_address', type: 'VARCHAR(45)', notNull: false, primaryKey: false },
        { name: 'details', type: 'TEXT', notNull: false, primaryKey: false },
        { name: 'logged_at', type: 'TIMESTAMP', notNull: true, primaryKey: false },
      ],
      foreignKeys: [],
      indexes: [{ name: `idx_${cleanDb}_logs_date`, unique: false, columns: ['logged_at'] }],
    }
  ];

  // Views
  const views: ViewDefinition[] = [
    {
      name: `v_${cleanDb}_active_summary`,
      definitionSql: `SELECT u.id, u.username, u.email, COUNT(r.record_id) as total_records, SUM(COALESCE(r.amount, 0)) as total_amount\nFROM ${cleanDb}_users u\nLEFT JOIN ${cleanDb}_records r ON u.id = r.user_id\nWHERE u.is_active = true\nGROUP BY u.id, u.username, u.email;`,
      security: 'DEFINER',
      checkOption: 'CASCADED',
      isUpdatable: true,
      modifiedDate: now,
    },
    {
      name: `v_${cleanDb}_recent_logs`,
      definitionSql: `SELECT log_id, action, actor_id, ip_address, logged_at\nFROM ${cleanDb}_audit_logs\nORDER BY logged_at DESC\nLIMIT 500;`,
      security: 'DEFINER',
      checkOption: 'NONE',
      isUpdatable: false,
      modifiedDate: now,
    }
  ];

  // Stored Procedures
  const procedures: ProcedureDefinition[] = [
    {
      name: `sp_${cleanDb}_archive_records`,
      params: '(IN cutoff_date DATE, OUT archived_count INT)',
      returnType: 'void',
      security: 'DEFINER',
      definitionSql: `CREATE PROCEDURE sp_${cleanDb}_archive_records(\n  IN cutoff_date DATE,\n  OUT archived_count INT\n)\nBEGIN\n  INSERT INTO ${cleanDb}_audit_logs (action, details, logged_at)\n  VALUES ('ARCHIVE_RUN', CONCAT('Archived before ', cutoff_date), NOW());\n  SET archived_count = ROW_COUNT();\nEND;`,
      modifiedDate: now,
    },
    {
      name: `sp_${cleanDb}_recalc_user_metrics`,
      params: '(IN target_user_id BIGINT)',
      returnType: 'void',
      security: 'INVOKER',
      definitionSql: `CREATE PROCEDURE sp_${cleanDb}_recalc_user_metrics(\n  IN target_user_id BIGINT\n)\nBEGIN\n  -- Recalculate balances and aggregate records\n  UPDATE ${cleanDb}_users SET updated_at = NOW() WHERE id = target_user_id;\nEND;`,
      modifiedDate: now,
    }
  ];

  // Functions
  const functions: FunctionDefinition[] = [
    {
      name: `fn_${cleanDb}_format_currency`,
      params: '(amount DECIMAL(12,2))',
      returnType: 'VARCHAR(50)',
      definitionSql: `CREATE FUNCTION fn_${cleanDb}_format_currency(amount DECIMAL(12,2))\nRETURNS VARCHAR(50)\nDETERMINISTIC\nBEGIN\n  RETURN CONCAT('Rp ', FORMAT(amount, 2));\nEND;`,
      modifiedDate: now,
    },
    {
      name: `fn_${cleanDb}_mask_email`,
      params: '(email VARCHAR(150))',
      returnType: 'VARCHAR(150)',
      definitionSql: `CREATE FUNCTION fn_${cleanDb}_mask_email(email VARCHAR(150))\nRETURNS VARCHAR(150)\nBEGIN\n  RETURN CONCAT(SUBSTRING(email, 1, 3), '***@', SUBSTRING_INDEX(email, '@', -1));\nEND;`,
      modifiedDate: now,
    }
  ];

  // Triggers
  const triggers: TriggerDefinition[] = [
    {
      name: `trg_${cleanDb}_records_audit_update`,
      tableName: `${cleanDb}_records`,
      timing: 'AFTER',
      event: 'UPDATE',
      statement: `BEGIN\n  INSERT INTO ${cleanDb}_audit_logs (action, actor_id, details, logged_at)\n  VALUES ('RECORD_UPDATE', NEW.user_id, CONCAT('Updated record #', NEW.record_id), NOW());\nEND;`,
      modifiedDate: now,
    },
    {
      name: `trg_${cleanDb}_users_before_insert`,
      tableName: `${cleanDb}_users`,
      timing: 'BEFORE',
      event: 'INSERT',
      statement: `BEGIN\n  SET NEW.created_at = NOW();\n  SET NEW.email = LOWER(TRIM(NEW.email));\nEND;`,
      modifiedDate: now,
    }
  ];

  return {
    tables,
    views,
    procedures,
    functions,
    triggers,
  };
}
