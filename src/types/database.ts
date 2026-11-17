export type DatabaseEngine = 'sqlite' | 'mysql' | 'postgres' | 'mariadb' | 'mongodb' | 'redis' | 'mssql';

export interface DatabaseConnection {
  id: string;
  name: string;
  engine: DatabaseEngine;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  useSsl?: boolean;
  useSsh?: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  isDefault?: boolean;
  connectedAt?: string;
  colorTag?: string;
  isClosed?: boolean;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  autoIncrement?: boolean;
  defaultValue?: string | null;
}

export interface ForeignKeyDefinition {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  onUpdate: string;
  onDelete: string;
  match: string;
}

export interface IndexDefinition {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
  indexes?: IndexDefinition[];
  rowCount?: number;
  dataLength?: string;
  engine?: string;
  collation?: string;
  modifiedDate?: string;
}

export interface ViewDefinition {
  name: string;
  definitionSql?: string;
  security?: string;
  checkOption?: string;
  isUpdatable?: boolean;
  modifiedDate?: string;
}

export interface ProcedureDefinition {
  name: string;
  params?: string;
  returnType?: string;
  security?: string;
  definitionSql?: string;
  modifiedDate?: string;
}

export interface FunctionDefinition {
  name: string;
  params?: string;
  returnType: string;
  definitionSql?: string;
  modifiedDate?: string;
}

export interface TriggerDefinition {
  name: string;
  tableName: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF' | string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  statement?: string;
  modifiedDate?: string;
}

export interface DatabaseObjects {
  tables: TableSchema[];
  views: ViewDefinition[];
  procedures: ProcedureDefinition[];
  functions: FunctionDefinition[];
  triggers: TriggerDefinition[];
}

export interface QueryResult {
  columns: string[];
  values: any[][];
  executionTimeMs: number;
  rowsAffected?: number;
  error?: string;
  timestamp: string;
  sql: string;
}

export type TabType = 
  | 'data-grid'
  | 'query-editor'
  | 'er-diagram'
  | 'table-designer'
  | 'charts'
  | 'data-generator'
  | 'structure-sync'
  | 'query-builder'
  | 'server-monitor'
  | 'user-manager'
  | 'backup-restore'
  | 'data-dictionary'
  | 'snippet-manager';

export interface WorkspaceTab {
  id: string;
  title: string;
  type: TabType;
  connectionId: string;
  databaseName?: string;
  tableName?: string;
  querySql?: string;
  initialViewMode?: 'grid' | 'form' | 'json' | 'hex';
}

