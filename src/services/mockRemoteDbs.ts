import type { DatabaseConnection, TableSchema } from '../types/database';

// Empty default connections - database list is solely populated from user's "New Connection"
export const INITIAL_CONNECTIONS: DatabaseConnection[] = [];

export const MOCK_REMOTE_SCHEMAS: Record<string, TableSchema[]> = {};
