import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Minus, 
  RefreshCw, 
  Download, 
  Upload,
  Key, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  Check, 
  Copy, 
  Clipboard,
  Eye, 
  CheckCircle2, 
  Undo2, 
  Code2, 
  CopyCheck,
  AlertTriangle,
  ArrowUp,
  Filter,
  ArrowDownWideNarrow,
  Square,
  Search,
  GitCompare,
  BarChart3,
  Settings,
  Trash2,
  Terminal,
  ChevronDown,
  X
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';
import { dbGateway } from '../services/dbGateway';
import type { TableSchema, QueryResult, DatabaseConnection } from '../types/database';
import { DateTimePicker, isTemporalColumn, isDateColumn } from './DateTimePicker';

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  databaseName: string;
  sql: string;
  summary: string;
  execMs: number;
  fetchMs: number;
  rowCount: number;
  isError?: boolean;
}

interface DataGridProps {
  connectionId: string;
  tableName: string;
  schema: TableSchema | null;
  initialViewMode?: 'grid' | 'form' | 'json' | 'hex';
  onRefreshSchema: () => void;
  activeConnection?: DatabaseConnection | null;
}

interface PendingCellEdit {
  rowIdx: number;
  pkVal: any;
  colName: string;
  originalVal: any;
  newVal: any;
}

interface StagedInsertRow {
  tempId: string;
  values: Record<string, string>;
  hasError?: boolean;
}

interface SubmitErrorInfo {
  message: string;
  rowNumber?: number;
  colName?: string;
  tempId?: string;
}

interface ActivePickerState {
  target: 'staged' | 'existing';
  rowKey: string | number;
  colName: string;
  anchorRect: DOMRect | null;
}

export interface CellCoord {
  rowIdx: number;
  colIdx: number;
}

export interface SelectionRange {
  start: CellCoord;
  end: CellCoord;
}

export const isNumericColumnOrValue = (val: any, colType?: string): boolean => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (colType && /^(int|integer|tinyint|smallint|mediumint|bigint|decimal|numeric|float|double|real)/i.test(colType)) {
    return !isNaN(Number(val));
  }
  return typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim());
};

export const DataGrid: React.FC<DataGridProps> = ({
  connectionId,
  tableName,
  schema,
  onRefreshSchema,
  activeConnection,
}) => {
  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [whereText, setWhereText] = useState<string>('');
  const [orderByText, setOrderByText] = useState<string>('');
  const [filteredRowCount, setFilteredRowCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Selected row state
  const [selectedRowType, setSelectedRowType] = useState<'existing' | 'staged'>('existing');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [selectedStagedTempId, setSelectedStagedTempId] = useState<string | null>(null);

  // Selected cell state (single/active cell navigation and copy-paste)
  const [selectedCell, setSelectedCell] = useState<{
    rowType: 'existing' | 'staged';
    rowIdx: number;
    colName: string;
    tempId?: string;
  } | null>(null);

  // Range / Block Selection State (2D coordinates across existing & staged rows)
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [isDraggingRange, setIsDraggingRange] = useState<boolean>(false);

  // Staging State:
  // 1. Pending Cell Edits (Updates)
  const [pendingEdits, setPendingEdits] = useState<PendingCellEdit[]>([]);

  // 2. Staged Deletions (Set of Primary Key values marked with strikethrough & soft red)
  const [stagedDeletes, setStagedDeletes] = useState<Set<any>>(new Set());

  // 3. Staged New Rows (Inserted rows shown with soft green & consecutive row numbering)
  const [stagedInserts, setStagedInserts] = useState<StagedInsertRow[]>([]);
  const [activeInsertTempId, setActiveInsertTempId] = useState<string | null>(null);
  const [activeInsertCol, setActiveInsertCol] = useState<string | null>(null);

  // Inline cell editing state (for existing rows)
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Column visibility
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [showColModal, setShowColModal] = useState(false);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIdx: number;
    colName: string;
    isStagedInsert?: boolean;
    tempId?: string;
  } | null>(null);

  // DML Preview Modal & Error State
  const [showDmlModal, setShowDmlModal] = useState<boolean>(false);
  const [isSubmittingAll, setIsSubmittingAll] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<SubmitErrorInfo | null>(null);
  const [missingRequiredCols, setMissingRequiredCols] = useState<Set<string>>(new Set());
  const [activePicker, setActivePicker] = useState<ActivePickerState | null>(null);

  // Unsubmitted changes confirmation modal
  const [showDiscardChangesModal, setShowDiscardChangesModal] = useState<boolean>(false);
  const [pendingActionAfterDiscard, setPendingActionAfterDiscard] = useState<(() => void) | null>(null);

  // Workspace Suite State (Toolbar, Console, Extractor, Quick Filters)
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [showConsole, setShowConsole] = useState<boolean>(true);
  const [consoleHeight, setConsoleHeight] = useState<number>(180);
  const [isDraggingConsole, setIsDraggingConsole] = useState<boolean>(false);
  const [txMode, setTxMode] = useState<'auto' | 'manual'>('auto');
  const [showTxMenu, setShowTxMenu] = useState<boolean>(false);
  const [activeExtractor, setActiveExtractor] = useState<'CSV' | 'TSV' | 'JSON' | 'SQL' | 'Markdown' | 'HTML'>('CSV');
  const [showExtractorMenu, setShowExtractorMenu] = useState<boolean>(false);
  const [showDdlModal, setShowDdlModal] = useState<boolean>(false);
  const [showChartModal, setShowChartModal] = useState<boolean>(false);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [showFindBar, setShowFindBar] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [colFilterPopover, setColFilterPopover] = useState<{ colName: string; x: number; y: number } | null>(null);
  const [colFilterOp, setColFilterOp] = useState<string>('LIKE');
  const [colFilterVal, setColFilterVal] = useState<string>('');
  const [hoveredColTooltip, setHoveredColTooltip] = useState<{ colName: string; colType: string; x: number; y: number } | null>(null);
  const [showPageMenu, setShowPageMenu] = useState<boolean>(false);
  const [execStats, setExecStats] = useState<{ execMs: number; fetchMs: number }>({ execMs: 4, fetchMs: 200 });
  const consoleBodyRef = useRef<HTMLDivElement>(null);

  const gridColumns = (data?.columns && data.columns.length > 0)
    ? data.columns
    : (schema?.columns?.map(c => c.name) || []);
  const visibleColumns = gridColumns.filter(c => !hiddenCols.includes(c));
  const primaryKeyCol = schema?.columns?.find(c => c.primaryKey || (c as any).isPk)?.name || gridColumns[0] || 'id';
  const totalPendingChanges = stagedInserts.length + pendingEdits.length + stagedDeletes.size;

  // --- Range / Block Selection Helpers ---
  const getNormalizedRange = () => {
    if (!selectionRange) return null;
    const minRow = Math.min(selectionRange.start.rowIdx, selectionRange.end.rowIdx);
    const maxRow = Math.max(selectionRange.start.rowIdx, selectionRange.end.rowIdx);
    const minCol = Math.min(selectionRange.start.colIdx, selectionRange.end.colIdx);
    const maxCol = Math.max(selectionRange.start.colIdx, selectionRange.end.colIdx);
    return { minRow, maxRow, minCol, maxCol };
  };

  const getCellRangeClasses = (rowIdx: number, colIdx: number) => {
    const range = getNormalizedRange();
    if (!range) return '';
    const inRange = rowIdx >= range.minRow && rowIdx <= range.maxRow && colIdx >= range.minCol && colIdx <= range.maxCol;
    if (!inRange) return '';

    const classes = ['cell-in-range'];
    if (rowIdx === range.minRow) classes.push('cell-range-top');
    if (rowIdx === range.maxRow) classes.push('cell-range-bottom');
    if (colIdx === range.minCol) classes.push('cell-range-left');
    if (colIdx === range.maxCol) classes.push('cell-range-right');
    return classes.join(' ');
  };

  // Global mouseup to stop drag selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingRange(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleCellMouseDown = (
    e: React.MouseEvent,
    rowIdx: number,
    colIdx: number,
    rowType: 'existing' | 'staged',
    tempId?: string
  ) => {
    // If right click (context menu)
    if (e.button === 2) {
      const range = getNormalizedRange();
      const inRange = range && rowIdx >= range.minRow && rowIdx <= range.maxRow && colIdx >= range.minCol && colIdx <= range.maxCol;
      if (!inRange) {
        setSelectionRange({ start: { rowIdx, colIdx }, end: { rowIdx, colIdx } });
        const colName = visibleColumns[colIdx];
        setSelectedCell({ rowType, rowIdx, colName, tempId });
        if (rowType === 'existing') {
          setSelectedRowType('existing');
          setSelectedRowIndex(rowIdx);
        } else {
          setSelectedRowType('staged');
          setSelectedStagedTempId(tempId || null);
        }
      }
      return;
    }

    if (e.button !== 0) return;

    const colName = visibleColumns[colIdx];
    if (e.shiftKey && selectionRange) {
      setSelectionRange({ start: selectionRange.start, end: { rowIdx, colIdx } });
    } else {
      setIsDraggingRange(true);
      setSelectionRange({ start: { rowIdx, colIdx }, end: { rowIdx, colIdx } });
      setSelectedCell({ rowType, rowIdx, colName, tempId });
      if (rowType === 'existing') {
        setSelectedRowType('existing');
        setSelectedRowIndex(rowIdx);
      } else {
        setSelectedRowType('staged');
        setSelectedStagedTempId(tempId || null);
      }
    }
  };

  const handleCellMouseEnter = (rowIdx: number, colIdx: number) => {
    if (isDraggingRange && selectionRange) {
      setSelectionRange(prev => prev ? { ...prev, end: { rowIdx, colIdx } } : null);
    }
  };

  const handleGutterMouseDown = (e: React.MouseEvent, rowIdx: number) => {
    if (e.button !== 0) return;
    setIsDraggingRange(true);
    setSelectionRange({
      start: { rowIdx, colIdx: 0 },
      end: { rowIdx, colIdx: Math.max(0, visibleColumns.length - 1) }
    });
    const existingCount = data?.values?.length || 0;
    if (rowIdx < existingCount) {
      setSelectedRowType('existing');
      setSelectedRowIndex(rowIdx);
      setSelectedCell({ rowType: 'existing', rowIdx, colName: visibleColumns[0] });
    } else {
      const sIdx = rowIdx - existingCount;
      const tempId = stagedInserts[sIdx]?.tempId;
      setSelectedRowType('staged');
      setSelectedStagedTempId(tempId || null);
      setSelectedCell({ rowType: 'staged', rowIdx: sIdx, colName: visibleColumns[0], tempId });
    }
  };

  const handleGutterMouseEnter = (rowIdx: number) => {
    if (isDraggingRange && selectionRange) {
      setSelectionRange(prev => prev ? {
        start: { ...prev.start, colIdx: 0 },
        end: { rowIdx, colIdx: Math.max(0, visibleColumns.length - 1) }
      } : null);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Global Keyboard Shortcuts (Cmd+N to add, Cmd+D to clone, Cmd+C/V to copy/paste, Cmd+Backspace to delete, Cmd+Z to revert, Cmd+Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (totalPendingChanges > 0) {
          handleSubmitAllChanges();
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.key === 'N') && !isInput) {
        e.preventDefault();
        handleAddNewRow();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D') && !isInput) {
        e.preventDefault();
        if (selectedRowType === 'existing' && selectedRowIndex >= 0) {
          handleCloneRow(selectedRowIndex);
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C') && !isInput) {
        e.preventDefault();
        handleCopySelection();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V') && !isInput) {
        e.preventDefault();
        handlePasteSelection();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A') && !isInput) {
        e.preventDefault();
        const totalRows = (data?.values?.length || 0) + stagedInserts.length;
        if (totalRows > 0 && visibleColumns.length > 0) {
          setSelectionRange({
            start: { rowIdx: 0, colIdx: 0 },
            end: { rowIdx: totalRows - 1, colIdx: visibleColumns.length - 1 }
          });
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace' && !isInput) {
        e.preventDefault();
        handleDeleteRowAction();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !isInput) {
        e.preventDefault();
        handleRevertAction();
      } else if (!isInput && !editingCell) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteSelectionOrRow();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const existingCount = data?.values?.length || 0;
          const totalRows = existingCount + stagedInserts.length;
          if (totalRows === 0 || visibleColumns.length === 0) return;

          let curRow = 0;
          let curCol = 0;
          if (selectionRange) {
            curRow = selectionRange.end.rowIdx;
            curCol = selectionRange.end.colIdx;
          } else if (selectedCell) {
            curRow = selectedCell.rowType === 'existing' ? selectedCell.rowIdx : existingCount + (selectedCell.rowIdx || 0);
            curCol = Math.max(0, visibleColumns.indexOf(selectedCell.colName));
          }

          let nextRow = curRow;
          let nextCol = curCol;

          if (e.key === 'ArrowRight') nextCol = Math.min(visibleColumns.length - 1, curCol + 1);
          if (e.key === 'ArrowLeft') nextCol = Math.max(0, curCol - 1);
          if (e.key === 'ArrowDown') nextRow = Math.min(totalRows - 1, curRow + 1);
          if (e.key === 'ArrowUp') nextRow = Math.max(0, curRow - 1);

          if (e.shiftKey) {
            const anchor = selectionRange?.start || { rowIdx: curRow, colIdx: curCol };
            setSelectionRange({ start: anchor, end: { rowIdx: nextRow, colIdx: nextCol } });
          } else {
            setSelectionRange({ start: { rowIdx: nextRow, colIdx: nextCol }, end: { rowIdx: nextRow, colIdx: nextCol } });
            const colName = visibleColumns[nextCol];
            if (nextRow < existingCount) {
              setSelectedRowType('existing');
              setSelectedRowIndex(nextRow);
              setSelectedCell({ rowType: 'existing', rowIdx: nextRow, colName });
            } else {
              const sIdx = nextRow - existingCount;
              const tempId = stagedInserts[sIdx]?.tempId;
              setSelectedRowType('staged');
              setSelectedStagedTempId(tempId || null);
              setSelectedCell({ rowType: 'staged', rowIdx: sIdx, colName, tempId });
            }
          }
        } else if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          const existingCount = data?.values?.length || 0;
          let curRow = 0;
          let curCol = 0;
          if (selectionRange) {
            curRow = selectionRange.end.rowIdx;
            curCol = selectionRange.end.colIdx;
          } else if (selectedCell) {
            curRow = selectedCell.rowType === 'existing' ? selectedCell.rowIdx : existingCount + (selectedCell.rowIdx || 0);
            curCol = Math.max(0, visibleColumns.indexOf(selectedCell.colName));
          }

          if (curRow < existingCount && data?.values[curRow]) {
            const colName = visibleColumns[curCol];
            const cIdx = data.columns.indexOf(colName);
            handleStartEdit(curRow, colName, data.values[curRow][cIdx]);
          } else if (curRow >= existingCount) {
            const sIdx = curRow - existingCount;
            const tempId = stagedInserts[sIdx]?.tempId;
            if (tempId) {
              setActiveInsertTempId(tempId);
              setActiveInsertCol(visibleColumns[curCol]);
            }
          }
        } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && !activeInsertCol) {
          // Printable character typed on active cell -> start editing immediately with that char!
          const existingCount = data?.values?.length || 0;
          let curRow = 0;
          let curCol = 0;
          if (selectionRange) {
            curRow = selectionRange.end.rowIdx;
            curCol = selectionRange.end.colIdx;
          } else if (selectedCell) {
            curRow = selectedCell.rowType === 'existing' ? selectedCell.rowIdx : existingCount + (selectedCell.rowIdx || 0);
            curCol = Math.max(0, visibleColumns.indexOf(selectedCell.colName));
          }

          const colName = visibleColumns[curCol];
          if (curRow < existingCount && data?.values[curRow]) {
            handleStartEdit(curRow, colName, e.key);
            e.preventDefault();
          } else if (curRow >= existingCount) {
            const sIdx = curRow - existingCount;
            const tempId = stagedInserts[sIdx]?.tempId;
            if (tempId) {
              setActiveInsertTempId(tempId);
              setActiveInsertCol(colName);
              handleUpdateStagedInsertValue(tempId, colName, e.key);
              e.preventDefault();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionRange, isDraggingRange, selectedRowType, selectedRowIndex, selectedStagedTempId, selectedCell, activeInsertTempId, totalPendingChanges, stagedDeletes, pendingEdits, stagedInserts, data, visibleColumns, activeExtractor]);

  const loadData = () => {
    setSubmitError(null);
    const t0 = performance.now();
    const dbName = activeConnection?.database || activeConnection?.name || 'coba';

    const recordSuccessLog = (rowCount: number, filterClause: string, orderClause: string) => {
      const execMs = Math.max(1, Math.round(performance.now() - t0));
      const fetchMs = Math.max(1, Math.round(execMs * 1.5 + 4));
      setExecStats({ execMs, fetchMs });

      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const newLog: ExecutionLogEntry = {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: timeStr,
        databaseName: dbName,
        sql: `SELECT t.*\nFROM ${dbName}.${tableName} t${filterClause ? `\n${filterClause}` : ''}${orderClause ? `\n${orderClause}` : ''}\nLIMIT ${pageSize}`,
        summary: `${rowCount} rows retrieved starting from 1 in ${execMs + fetchMs} ms (execution: ${execMs} ms, fetching: ${fetchMs} ms)`,
        execMs,
        fetchMs,
        rowCount,
      };

      setExecutionLogs(prev => {
        if (prev.length === 0) {
          return [
            {
              id: `init-${Date.now()}`,
              timestamp: timeStr,
              databaseName: dbName,
              sql: `use ${dbName}`,
              summary: `completed in 1 ms`,
              execMs: 1,
              fetchMs: 0,
              rowCount: 0,
            },
            newLog
          ];
        }
        return [...prev.slice(-49), newLog];
      });
    };

    if (activeConnection && activeConnection.engine !== 'sqlite') {
      setLoading(true);
      const isMySql = activeConnection.engine === 'mysql' || activeConnection.engine === 'mariadb';
      const qTable = isMySql ? `\`${tableName}\`` : `"${tableName}"`;

      let filterClause = '';
      if (whereText && whereText.trim()) {
        const cleanWhere = whereText.trim().replace(/^where\s+/i, '');
        filterClause = `WHERE ${cleanWhere}`;
      }

      let orderClause = '';
      if (orderByText && orderByText.trim()) {
        const cleanOrder = orderByText.trim().replace(/^order\s+by\s+/i, '');
        orderClause = `ORDER BY ${cleanOrder}`;
      } else if (sortCol) {
        orderClause = `ORDER BY ${isMySql ? `\`${sortCol}\`` : `"${sortCol}"`} ${sortOrder}`;
      }

      const query = `SELECT * FROM ${qTable} ${filterClause} ${orderClause} LIMIT ${pageSize} OFFSET ${page * pageSize};`;
      dbGateway.executeQuery(activeConnection, query).then(res => {
        if (res.error) {
          setSubmitError({ message: res.error });
          return;
        }
        setData(res);
        if (res.values && res.values.length > 0 && selectedRowIndex >= res.values.length) {
          setSelectedRowIndex(0);
        }
        recordSuccessLog(res.values?.length || 0, filterClause, orderClause);

        if (filterClause) {
          const countQuery = `SELECT COUNT(*) as total FROM ${qTable} ${filterClause};`;
          dbGateway.executeQuery(activeConnection, countQuery).then(cRes => {
            if (cRes && cRes.values && cRes.values[0] && cRes.values[0][0] !== undefined) {
              setFilteredRowCount(Number(cRes.values[0][0]));
            }
          }).catch(() => {});
        } else {
          setFilteredRowCount(null);
        }
      }).catch(err => {
        console.error('Remote data load error:', err);
        setSubmitError({
          message: err?.message || String(err),
        });
      }).finally(() => {
        setLoading(false);
      });
      return;
    }

    setLoading(true);
    try {
      const res = dbEngine.getTableData(
        connectionId,
        tableName,
        page * pageSize,
        pageSize,
        sortCol || undefined,
        sortOrder,
        undefined,
        whereText || undefined,
        orderByText || undefined
      );
      setData(res);
      if (res.values.length > 0 && selectedRowIndex >= res.values.length) {
        setSelectedRowIndex(0);
      }
      const filterClause = whereText ? `WHERE ${whereText.replace(/^where\s+/i, '')}` : '';
      const orderClause = orderByText ? `ORDER BY ${orderByText.replace(/^order\s+by\s+/i, '')}` : (sortCol ? `ORDER BY "${sortCol}" ${sortOrder}` : '');
      recordSuccessLog(res.values.length, filterClause, orderClause);

      if (whereText && whereText.trim()) {
        const count = dbEngine.getFilteredRowCount(connectionId, tableName, whereText);
        setFilteredRowCount(count);
      } else {
        setFilteredRowCount(null);
      }
    } catch (err: any) {
      console.error('Failed to load table data:', err);
      setSubmitError({
        message: err?.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [connectionId, tableName, page, pageSize, sortCol, sortOrder]);

  const handleQuerySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(0);
    loadData();
  };

  const handleSort = (colName: string) => {
    const isMySql = activeConnection ? (activeConnection.engine === 'mysql' || activeConnection.engine === 'mariadb') : false;
    const qCol = isMySql ? `\`${colName}\`` : `"${colName}"`;
    let nextOrder: 'ASC' | 'DESC' = 'ASC';
    if (sortCol === colName) {
      nextOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
    }
    setSortCol(colName);
    setSortOrder(nextOrder);
    setOrderByText(`${qCol} ${nextOrder}`);
    setPage(0);
  };

  // --- Workspace Suite Handlers ---
  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingConsole(true);
    const startY = e.clientY;
    const startH = consoleHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(80, Math.min(600, startH + delta));
      setConsoleHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsDraggingConsole(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const generateTableDdl = (): string => {
    const isMySql = activeConnection?.engine === 'mysql' || activeConnection?.engine === 'mariadb';
    const q = isMySql ? '`' : '"';
    
    let ddl = `CREATE TABLE ${q}${tableName}${q} (\n`;
    const cols = (schema?.columns && schema.columns.length > 0)
      ? schema.columns
      : visibleColumns.map(col => ({ name: col, type: 'VARCHAR(255)', primaryKey: false, notNull: false, defaultValue: undefined, autoIncrement: false }));

    const colLines = cols.map(col => {
      let line = `  ${q}${col.name}${q} ${col.type || 'VARCHAR(255)'}`;
      if (col.primaryKey) {
        if (isMySql && (col as any).autoIncrement) line += ' AUTO_INCREMENT';
        line += ' PRIMARY KEY';
      }
      if (col.notNull && !col.primaryKey) line += ' NOT NULL';
      if (col.defaultValue !== undefined && col.defaultValue !== null && col.defaultValue !== '') {
        line += ` DEFAULT ${col.defaultValue}`;
      }
      return line;
    });
    ddl += colLines.join(',\n');
    ddl += '\n);';
    return ddl;
  };

  const handleExportWithExtractor = () => {
    if (!data || !data.columns) return;
    let content = '';
    let mimeType = 'text/plain';
    let ext = 'txt';

    if (activeExtractor === 'CSV') {
      mimeType = 'text/csv;charset=utf-8;';
      ext = 'csv';
      const header = data.columns.join(',');
      const rows = data.values.map(row => 
        row.map(val => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      );
      content = [header, ...rows].join('\n');
    } else if (activeExtractor === 'TSV') {
      mimeType = 'text/tab-separated-values;charset=utf-8;';
      ext = 'tsv';
      content = [data.columns.join('\t'), ...data.values.map(r => r.join('\t'))].join('\n');
    } else if (activeExtractor === 'JSON') {
      mimeType = 'application/json;charset=utf-8;';
      ext = 'json';
      const objs = data.values.map(row => {
        const obj: Record<string, any> = {};
        data.columns.forEach((c, i) => { obj[c] = row[i]; });
        return obj;
      });
      content = JSON.stringify(objs, null, 2);
    } else if (activeExtractor === 'SQL') {
      mimeType = 'text/sql;charset=utf-8;';
      ext = 'sql';
      const q = activeConnection?.engine === 'mysql' ? '`' : '"';
      content = data.values.map(row => {
        const vals = row.map(v => v === null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`);
        return `INSERT INTO ${q}${tableName}${q} (${data.columns.map(c => `${q}${c}${q}`).join(', ')}) VALUES (${vals.join(', ')});`;
      }).join('\n');
    } else if (activeExtractor === 'Markdown') {
      mimeType = 'text/markdown;charset=utf-8;';
      ext = 'md';
      const header = `| ${data.columns.join(' | ')} |`;
      const sep = `| ${data.columns.map(() => '---').join(' | ')} |`;
      const rows = data.values.map(r => `| ${r.map(v => v === null ? 'NULL' : String(v)).join(' | ')} |`);
      content = [header, sep, ...rows].join('\n');
    } else if (activeExtractor === 'HTML') {
      mimeType = 'text/html;charset=utf-8;';
      ext = 'html';
      content = `<table>\n  <thead><tr>${data.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>\n  <tbody>\n${data.values.map(r => `    <tr>${r.map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('\n')}\n  </tbody>\n</table>`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${tableName}_${Date.now()}.${ext}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopyFeedback(`Exported ${activeExtractor} file`);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleApplyColFilter = () => {
    if (!colFilterPopover) return;
    const { colName } = colFilterPopover;
    let newClause = '';
    const isMySql = activeConnection?.engine === 'mysql' || activeConnection?.engine === 'mariadb';
    const qCol = isMySql ? `\`${colName}\`` : `"${colName}"`;

    if (colFilterOp === 'IS NULL') {
      newClause = `${qCol} IS NULL`;
    } else if (colFilterOp === 'IS NOT NULL') {
      newClause = `${qCol} IS NOT NULL`;
    } else if (colFilterOp === 'LIKE') {
      newClause = `${qCol} LIKE '%${colFilterVal.replace(/'/g, "''")}%'`;
    } else {
      newClause = `${qCol} ${colFilterOp} '${colFilterVal.replace(/'/g, "''")}'`;
    }

    let updatedWhere = whereText.trim();
    if (updatedWhere) {
      updatedWhere = `${updatedWhere} AND ${newClause}`;
    } else {
      updatedWhere = newClause;
    }
    setWhereText(updatedWhere);
    setColFilterPopover(null);
    setPage(0);
    setTimeout(() => loadData(), 0);
  };

  const handleClearColFilter = () => {
    if (!colFilterPopover) return;
    const { colName } = colFilterPopover;
    const escapedCol = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\s*AND\\s*)?(["\`]?${escapedCol}["\`]?[^AND]+)`, 'i');
    let updatedWhere = whereText.replace(regex, '').trim();
    if (updatedWhere.startsWith('AND ') || updatedWhere.startsWith('and ')) {
      updatedWhere = updatedWhere.substring(4).trim();
    }
    setWhereText(updatedWhere);
    setColFilterPopover(null);
    setPage(0);
    setTimeout(() => loadData(), 0);
  };

  const renderHighlightedSql = (sql: string) => {
    const parts = sql.split(/(\bSELECT\b|\bFROM\b|\bWHERE\b|\bORDER BY\b|\bLIMIT\b|\bOFFSET\b|\bAND\b|\bOR\b|\bDESC\b|\bASC\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bSET\b|\bINTO\b|\bVALUES\b|\bUSE\b)/gi);
    return (
      <>
        {parts.map((p, i) => {
          if (/^(SELECT|FROM|WHERE|ORDER BY|LIMIT|OFFSET|AND|OR|DESC|ASC|INSERT|UPDATE|DELETE|SET|INTO|VALUES|USE)$/i.test(p)) {
            return <span key={i} className="dg-log-sql-keyword">{p} </span>;
          }
          if (/^\d+$/.test(p.trim())) {
            return <span key={i} className="dg-log-number">{p}</span>;
          }
          return <span key={i} className="dg-log-sql-text">{p}</span>;
        })}
      </>
    );
  };

  const renderQuickChart = () => {
    if (!data || !data.values || data.values.length === 0) {
      return <div style={{ color: '#8c919b', textAlign: 'center', padding: '40px' }}>No data records to visualize</div>;
    }
    const numericCols = gridColumns.filter((_, idx) => {
      const firstVal = data.values[0]?.[idx];
      return typeof firstVal === 'number' || (!isNaN(Number(firstVal)) && firstVal !== null && firstVal !== '');
    });
    const labelCol = gridColumns.find(c => !numericCols.includes(c)) || gridColumns[0];
    const valCol = numericCols[0] || gridColumns[0];

    const labelIdx = data.columns.indexOf(labelCol);
    const valIdx = data.columns.indexOf(valCol);

    const rows = data.values.slice(0, 15);
    const maxVal = Math.max(...rows.map(r => Number(r[valIdx]) || 0), 1);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8c919b' }}>
          <span>Metric: <strong style={{ color: '#fff' }}>{valCol}</strong></span>
          <span>Grouping: <strong style={{ color: '#fff' }}>{labelCol}</strong></span>
          <span>Showing first {rows.length} rows</span>
        </div>
        <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '16px 8px 32px 8px', background: '#141517', borderRadius: '6px', border: '1px solid #2e3136' }}>
          {rows.map((r, i) => {
            const raw = Number(r[valIdx]) || 0;
            const pct = Math.max(8, Math.min(100, Math.round((raw / maxVal) * 100)));
            const lbl = String(r[labelIdx] ?? i + 1);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                <span style={{ fontSize: '10px', color: '#61afef', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>{raw}</span>
                <div 
                  style={{ 
                    width: '100%', 
                    height: `${pct}%`, 
                    background: 'linear-gradient(180deg, #3574f0 0%, #2154bf 100%)', 
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease'
                  }} 
                  title={`${lbl}: ${raw}`}
                />
                <span style={{ 
                  position: 'absolute', 
                  bottom: '-22px', 
                  fontSize: '10px', 
                  color: '#8c919b', 
                  maxWidth: '50px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {lbl}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- 1. EDITING DATA (Staged Updates) ---
  const handleStartEdit = (rowIdx: number, colName: string, currentVal: any) => {
    if (data && data.values[rowIdx]) {
      const pkColIdx = data.columns.indexOf(primaryKeyCol);
      const pkVal = data.values[rowIdx][pkColIdx];
      if (stagedDeletes.has(pkVal)) return;
    }
    setEditingCell({ rowIdx, colName });
    setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal));
  };

  const handleStageEdit = (rowIdx: number, colName: string) => {
    if (!data || !editingCell) return;
    const row = data.values[rowIdx];
    const pkColIdx = data.columns.indexOf(primaryKeyCol);
    if (pkColIdx === -1) return;

    const pkVal = row[pkColIdx];
    const originalVal = row[data.columns.indexOf(colName)];

    if (String(originalVal) === editValue) {
      setPendingEdits(prev => prev.filter(p => !(p.rowIdx === rowIdx && p.colName === colName)));
    } else {
      setPendingEdits(prev => [
        ...prev.filter(p => !(p.rowIdx === rowIdx && p.colName === colName)),
        {
          rowIdx,
          pkVal,
          colName,
          originalVal,
          newVal: editValue,
        },
      ]);
    }

    const updatedValues = [...data.values];
    const colIdx = data.columns.indexOf(colName);
    updatedValues[rowIdx] = [...updatedValues[rowIdx]];
    updatedValues[rowIdx][colIdx] = editValue;
    setData({ ...data, values: updatedValues });

    setEditingCell(null);
  };

  // Refresh with guard for unsubmitted changes
  const handleRefreshClick = () => {
    if (totalPendingChanges > 0) {
      setShowDiscardChangesModal(true);
      setPendingActionAfterDiscard(() => () => {
        handleRevertAll();
        loadData();
      });
    } else {
      loadData();
    }
  };

  // --- 2. ADDING DATA (Staged Inserts) ---
  const handleAddNewRow = () => {
    const tempId = 'staged_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const initialValues: Record<string, string> = {};
    visibleColumns.forEach(c => {
      initialValues[c] = '';
    });

    const newIndex = (data?.values?.length || 0) + stagedInserts.length;
    setStagedInserts(prev => [...prev, { tempId, values: initialValues, hasError: false }]);
    setSelectedRowType('staged');
    setSelectedStagedTempId(tempId);

    // Auto-select the first editable column without forcing inline input mode
    const firstEditableCol = visibleColumns.find(c => {
      const colDef = schema?.columns?.find(col => col.name === c);
      const isAuto = colDef?.autoIncrement || (colDef?.primaryKey && (!colDef.type || /int/i.test(colDef.type))) || c.toLowerCase() === 'id';
      return !isAuto;
    }) || visibleColumns[0];
    const firstColIdx = visibleColumns.indexOf(firstEditableCol);

    setSelectedCell({
      rowType: 'staged',
      rowIdx: stagedInserts.length,
      colName: firstEditableCol,
      tempId,
    });
    setSelectionRange({
      start: { rowIdx: newIndex, colIdx: Math.max(0, firstColIdx) },
      end: { rowIdx: newIndex, colIdx: Math.max(0, firstColIdx) },
    });
    setActiveInsertTempId(null);
    setActiveInsertCol(null);
    setSubmitError(null);
  };

  const handleUpdateStagedInsertValue = (tempId: string, colName: string, val: string) => {
    setStagedInserts(prev => prev.map(r => {
      if (r.tempId === tempId) {
        return { ...r, values: { ...r.values, [colName]: val }, hasError: false };
      }
      return r;
    }));
    setSubmitError(null);
    if (missingRequiredCols.has(colName) && val.trim() !== '') {
      setMissingRequiredCols(prev => {
        const next = new Set(prev);
        next.delete(colName);
        return next;
      });
    }
  };

  const handleDeleteStagedInsert = (tempId: string) => {
    setStagedInserts(prev => prev.filter(r => r.tempId !== tempId));
    if (activeInsertTempId === tempId) {
      setActiveInsertTempId(null);
      setActiveInsertCol(null);
    }
    if (selectedStagedTempId === tempId) {
      setSelectedStagedTempId(null);
      setSelectedRowType('existing');
    }
    if (submitError?.tempId === tempId) {
      setSubmitError(null);
    }
  };

  const handleStagedCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    _tempId: string,
    col: string,
    _insertIdx: number
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const cIdx = visibleColumns.indexOf(col);
      if (e.shiftKey) {
        if (cIdx > 0) {
          setActiveInsertCol(visibleColumns[cIdx - 1]);
        }
      } else {
        if (cIdx < visibleColumns.length - 1) {
          setActiveInsertCol(visibleColumns[cIdx + 1]);
        } else {
          // Tab past last column: add a new row
          handleAddNewRow();
        }
      }
    } else if (e.key === 'Enter') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        handleSubmitAllChanges();
      } else {
        e.preventDefault();
        const cIdx = visibleColumns.indexOf(col);
        if (cIdx < visibleColumns.length - 1) {
          setActiveInsertCol(visibleColumns[cIdx + 1]);
        }
      }
    } else if (e.key === 'Escape') {
      setActiveInsertCol(null);
    }
  };

  const handleDeleteRowAction = () => {
    if (selectedRowType === 'staged' && selectedStagedTempId) {
      handleDeleteStagedInsert(selectedStagedTempId);
      return;
    }
    if (activeInsertTempId) {
      handleDeleteStagedInsert(activeInsertTempId);
      return;
    }
    if (data && data.values.length > 0 && selectedRowIndex >= 0 && selectedRowIndex < data.values.length) {
      handleToggleDeleteRow(selectedRowIndex);
    }
  };

  const handleRevertAction = () => {
    if (selectedRowType === 'staged' && selectedStagedTempId) {
      handleDeleteStagedInsert(selectedStagedTempId);
      return;
    }
    if (activeInsertTempId) {
      handleDeleteStagedInsert(activeInsertTempId);
      return;
    }
    if (stagedInserts.length > 0) {
      const last = stagedInserts[stagedInserts.length - 1];
      handleDeleteStagedInsert(last.tempId);
      return;
    }
    handleRevertSelected();
  };

  const handleCloneRow = (rowIdx: number) => {
    if (!data || !data.values[rowIdx]) return;
    const row = data.values[rowIdx];
    const tempId = 'staged_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const clonedValues: Record<string, string> = {};

    data.columns.forEach((col, idx) => {
      if (col === primaryKeyCol) {
        clonedValues[col] = '';
      } else {
        clonedValues[col] = row[idx] === null || row[idx] === undefined ? '' : String(row[idx]);
      }
    });

    setStagedInserts(prev => [...prev, { tempId, values: clonedValues, hasError: false }]);
    setSelectedRowType('staged');
    setSelectedStagedTempId(tempId);
    setActiveInsertTempId(tempId);
    setActiveInsertCol(visibleColumns.find(c => c !== primaryKeyCol) || visibleColumns[0]);
    setContextMenu(null);
  };

  // --- 3. DELETING DATA (Staged Deletes with Strikethrough & Red Tint) ---
  const handleToggleDeleteRow = (rowIdx: number) => {
    if (!data || !data.values[rowIdx]) return;
    const row = data.values[rowIdx];
    const pkColIdx = data.columns.indexOf(primaryKeyCol);
    if (pkColIdx === -1) return;

    const pkVal = row[pkColIdx];
    setStagedDeletes(prev => {
      const next = new Set(prev);
      if (next.has(pkVal)) {
        next.delete(pkVal);
      } else {
        next.add(pkVal);
        setPendingEdits(pe => pe.filter(p => p.pkVal !== pkVal));
      }
      return next;
    });
    setContextMenu(null);
  };

  // --- 4. REVERT CHANGES (Rollback Staged Modifications) ---
  const handleRevertSelected = () => {
    if (stagedInserts.length > 0 && activeInsertTempId) {
      handleDeleteStagedInsert(activeInsertTempId);
      return;
    }

    if (!data || !data.values[selectedRowIndex]) return;
    const pkColIdx = data.columns.indexOf(primaryKeyCol);
    if (pkColIdx === -1) return;
    const pkVal = data.values[selectedRowIndex][pkColIdx];

    if (stagedDeletes.has(pkVal)) {
      setStagedDeletes(prev => {
        const next = new Set(prev);
        next.delete(pkVal);
        return next;
      });
      return;
    }

    const editsForThisRow = pendingEdits.filter(p => p.pkVal === pkVal);
    if (editsForThisRow.length > 0) {
      const updatedValues = [...data.values];
      const row = [...updatedValues[selectedRowIndex]];
      editsForThisRow.forEach(edit => {
        const cIdx = data.columns.indexOf(edit.colName);
        row[cIdx] = edit.originalVal;
      });
      updatedValues[selectedRowIndex] = row;
      setData({ ...data, values: updatedValues });
      setPendingEdits(prev => prev.filter(p => p.pkVal !== pkVal));
    }
  };

  const handleRevertAll = () => {
    setStagedInserts([]);
    setStagedDeletes(new Set());
    setPendingEdits([]);
    setSubmitError(null);
    setMissingRequiredCols(new Set());
    loadData();
  };

  const handleSetNull = (rowIdx: number, colName: string) => {
    if (!data || !data.values[rowIdx]) return;
    const pkColIdx = data.columns.indexOf(primaryKeyCol);
    const pkVal = data.values[rowIdx][pkColIdx];
    const originalVal = data.values[rowIdx][data.columns.indexOf(colName)];

    setPendingEdits(prev => [
      ...prev.filter(p => !(p.rowIdx === rowIdx && p.colName === colName)),
      {
        rowIdx,
        pkVal,
        colName,
        originalVal,
        newVal: null,
      },
    ]);

    const updatedValues = [...data.values];
    const colIdx = data.columns.indexOf(colName);
    updatedValues[rowIdx] = [...updatedValues[rowIdx]];
    updatedValues[rowIdx][colIdx] = null;
    setData({ ...data, values: updatedValues });
    setContextMenu(null);
  };

  const handleSetEmptyString = (rowIdx: number, colName: string) => {
    if (!data || !data.values[rowIdx]) return;
    const pkColIdx = data.columns.indexOf(primaryKeyCol);
    const pkVal = data.values[rowIdx][pkColIdx];
    const originalVal = data.values[rowIdx][data.columns.indexOf(colName)];

    setPendingEdits(prev => [
      ...prev.filter(p => !(p.rowIdx === rowIdx && p.colName === colName)),
      {
        rowIdx,
        pkVal,
        colName,
        originalVal,
        newVal: '',
      },
    ]);

    const updatedValues = [...data.values];
    const colIdx = data.columns.indexOf(colName);
    updatedValues[rowIdx] = [...updatedValues[rowIdx]];
    updatedValues[rowIdx][colIdx] = '';
    setData({ ...data, values: updatedValues });
    setContextMenu(null);
  };

  // --- 5. GENERATE DML SCRIPT (Preview DML & Execution) ---
  const generateDmlStatements = (): string[] => {
    const statements: string[] = [];
    const isMySql = activeConnection ? (activeConnection.engine === 'mysql' || activeConnection.engine === 'mariadb') : false;
    const qCol = (c: string) => isMySql ? `\`${c}\`` : `"${c}"`;
    const qTable = isMySql ? `\`${tableName}\`` : `"${tableName}"`;

    stagedInserts.forEach(row => {
      const enteredCols = Object.keys(row.values).filter(k => {
        const v = row.values[k];
        const colDef = schema?.columns?.find(c => c.name === k);
        const isAutoInc = colDef?.autoIncrement || (colDef?.primaryKey && (!colDef.type || /int/i.test(colDef.type))) || k.toLowerCase() === 'id';
        // Exclude auto-increment columns if value is empty or '<generated>'
        if (isAutoInc && (!v || v.trim() === '' || v === '<generated>')) {
          return false;
        }
        if (v === undefined || v.trim() === '' || v === '<null>' || v === '<default>') {
          return false;
        }
        return true;
      });

      if (enteredCols.length === 0) {
        statements.push(isMySql ? `INSERT INTO ${qTable} () VALUES ();` : `INSERT INTO ${qTable} DEFAULT VALUES;`);
      } else {
        const colList = enteredCols.map(qCol).join(', ');
        const valList = enteredCols.map(c => {
          const v = row.values[c];
          if (v === '<null>' || v.toUpperCase() === 'NULL') return 'NULL';
          return `'${v.replace(/'/g, "''")}'`;
        }).join(', ');
        statements.push(`INSERT INTO ${qTable} (${colList}) VALUES (${valList});`);
      }
    });

    pendingEdits.forEach(edit => {
      const valStr = edit.newVal === null || String(edit.newVal).toUpperCase() === 'NULL' || edit.newVal === '<null>'
        ? 'NULL'
        : `'${String(edit.newVal).replace(/'/g, "''")}'`;
      const pkStr = typeof edit.pkVal === 'number' ? edit.pkVal : `'${String(edit.pkVal).replace(/'/g, "''")}'`;
      statements.push(`UPDATE ${qTable} SET ${qCol(edit.colName)} = ${valStr} WHERE ${qCol(primaryKeyCol)} = ${pkStr};`);
    });

    stagedDeletes.forEach(pkVal => {
      const pkStr = typeof pkVal === 'number' ? pkVal : `'${String(pkVal).replace(/'/g, "''")}'`;
      statements.push(`DELETE FROM ${qTable} WHERE ${qCol(primaryKeyCol)} = ${pkStr};`);
    });

    return statements;
  };

  // --- 6. SUBMIT ALL MUTATIONS (Transaction Batch) ---
  const handleSubmitAllChanges = async () => {
    setSubmitError(null);
    setMissingRequiredCols(new Set());

    // 1. Client-side pre-validation for staged inserts
    if (schema?.columns && stagedInserts.length > 0) {
      for (let i = 0; i < stagedInserts.length; i++) {
        const r = stagedInserts[i];
        for (const colDef of schema.columns) {
          const hasDefault = Boolean(colDef.defaultValue !== undefined && colDef.defaultValue !== null && colDef.defaultValue !== '');
          const isRequired = Boolean(colDef.notNull && !hasDefault && !colDef.autoIncrement && !colDef.primaryKey);
          if (isRequired) {
            const v = r.values[colDef.name];
            if (v === undefined || v.trim() === '' || v === '<null>') {
              setMissingRequiredCols(new Set([colDef.name]));
              setStagedInserts(prev => prev.map(row => ({ ...row, hasError: true })));
              const rowDisplayNum = (data?.values?.length || 0) + i + 1;
              setSubmitError({
                message: `[23000][1048] Column '${colDef.name}' cannot be null`,
                rowNumber: rowDisplayNum,
                colName: colDef.name,
                tempId: r.tempId,
              });
              setActiveInsertTempId(r.tempId);
              setActiveInsertCol(colDef.name);
              return;
            }
          }
        }
      }
    }

    const statements = generateDmlStatements();
    if (statements.length === 0) return;

    setIsSubmittingAll(true);
    try {
      if (activeConnection && activeConnection.engine !== 'sqlite') {
        for (const sql of statements) {
          const res = await dbGateway.executeQuery(activeConnection, sql);
          if (res.error) {
            throw new Error(res.error);
          }
        }
      } else {
        for (const sql of statements) {
          dbEngine.execute(connectionId, sql);
        }
      }

      setStagedInserts([]);
      setStagedDeletes(new Set());
      setPendingEdits([]);
      setShowDmlModal(false);
      setSubmitError(null);
      setMissingRequiredCols(new Set());
      loadData();
      onRefreshSchema();
    } catch (err: any) {
      const rawMsg = err?.message || String(err);
      let colName: string | undefined;
      const matchCol = rawMsg.match(/Column '([^']+)' cannot be null/i);
      if (matchCol) {
        colName = matchCol[1];
      }
      if (stagedInserts.length > 0) {
        setStagedInserts(prev => prev.map(r => ({ ...r, hasError: true })));
      }
      const formattedMsg = rawMsg.includes('[23000]') 
        ? rawMsg 
        : matchCol 
        ? `[23000][1048] ${rawMsg}` 
        : rawMsg;
      setSubmitError({
        message: formattedMsg,
        rowNumber: stagedInserts.length > 0 ? (data?.values?.length || 0) + 1 : 1,
        colName,
        tempId: stagedInserts[0]?.tempId,
      });
    } finally {
      setIsSubmittingAll(false);
    }
  };

  const handleJumpToErrorRow = () => {
    if (submitError?.tempId) {
      setActiveInsertTempId(submitError.tempId);
      if (submitError.colName) {
        setActiveInsertCol(submitError.colName);
      }
    } else if (submitError?.rowNumber !== undefined) {
      const rIdx = Math.max(0, submitError.rowNumber - 1);
      setSelectedRowIndex(rIdx);
      if (submitError.colName && data?.columns) {
        const cIdx = data.columns.indexOf(submitError.colName);
        if (cIdx !== -1 && data.values[rIdx]) {
          handleStartEdit(rIdx, submitError.colName, data.values[rIdx][cIdx]);
        }
      }
    }
  };

  const handleCopyAsInsert = () => {
    if (!data || data.values.length === 0) return;
    const row = data.values[selectedRowIndex];
    const cols = data.columns.map(c => `"${c}"`).join(', ');
    const vals = row.map(v => v === null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`).join(', ');
    const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`;
    navigator.clipboard.writeText(sql);
    setCopyFeedback('Copied as INSERT statement!');
    setContextMenu(null);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleCopyAsUpdate = () => {
    if (!data || data.values.length === 0) return;
    const row = data.values[selectedRowIndex];
    const pkColIdx = data.columns.indexOf(primaryKeyCol);
    const pkVal = row[pkColIdx];

    const sets = data.columns
      .filter(c => c !== primaryKeyCol)
      .map(c => {
        const v = row[data.columns.indexOf(c)];
        const valStr = v === null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`;
        return `"${c}" = ${valStr}`;
      })
      .join(', ');

    const sql = `UPDATE "${tableName}" SET ${sets} WHERE "${primaryKeyCol}" = ${typeof pkVal === 'number' ? pkVal : `'${pkVal}'`};`;
    navigator.clipboard.writeText(sql);
    setCopyFeedback('Copied as UPDATE statement!');
    setContextMenu(null);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // --- Copy & Paste Handling ---
  const handleDeleteSelectionOrRow = () => {
    const norm = getNormalizedRange();
    const existingCount = data?.values?.length || 0;

    // 1. Multi-cell range selected -> clear all cells in range to null/empty
    if (norm && (norm.minRow !== norm.maxRow || norm.minCol !== norm.maxCol)) {
      let updatedExistingValues = data ? data.values.map(r => [...r]) : [];
      let updatedStagedInserts = stagedInserts.map(r => ({ ...r, values: { ...r.values } }));
      let newPendingEdits = [...pendingEdits];
      const pkColIdx = data ? data.columns.indexOf(primaryKeyCol) : -1;

      for (let r = norm.minRow; r <= norm.maxRow; r++) {
        for (let c = norm.minCol; c <= norm.maxCol; c++) {
          const colName = visibleColumns[c];
          if (r < existingCount && data) {
            const realColIdx = data.columns.indexOf(colName);
            const pkVal = pkColIdx !== -1 ? data.values[r][pkColIdx] : null;
            const originalVal = data.values[r][realColIdx];

            newPendingEdits = newPendingEdits.filter(p => !(p.rowIdx === r && p.colName === colName));
            newPendingEdits.push({
              rowIdx: r,
              pkVal,
              colName,
              originalVal,
              newVal: null,
            });
            updatedExistingValues[r][realColIdx] = null;
          } else {
            const stagedIdx = r - existingCount;
            if (stagedIdx < updatedStagedInserts.length) {
              updatedStagedInserts[stagedIdx].values[colName] = '';
            }
          }
        }
      }

      if (data && updatedExistingValues.length > 0) {
        setData({ ...data, values: updatedExistingValues });
      }
      setPendingEdits(newPendingEdits);
      setStagedInserts(updatedStagedInserts);
      setSubmitError(null);
      setCopyFeedback('Cleared selected cells to NULL');
      setTimeout(() => setCopyFeedback(null), 2000);
      return;
    }

    // 2. Single cell selected -> clear cell to null/empty
    if (norm && norm.minRow === norm.maxRow && norm.minCol === norm.maxCol) {
      const r = norm.minRow;
      const colName = visibleColumns[norm.minCol];
      if (r < existingCount && data) {
        handleSetNull(r, colName);
      } else {
        const stagedIdx = r - existingCount;
        if (stagedIdx < stagedInserts.length) {
          setStagedInserts(prev => prev.map((row, idx) => idx === stagedIdx ? { ...row, values: { ...row.values, [colName]: '' } } : row));
          setSubmitError(null);
        }
      }
      return;
    }

    if (selectedCell) {
      if (selectedCell.rowType === 'existing') {
        handleSetNull(selectedCell.rowIdx, selectedCell.colName);
      } else if (selectedCell.tempId) {
        setStagedInserts(prev => prev.map(r => r.tempId === selectedCell.tempId ? { ...r, values: { ...r.values, [selectedCell.colName]: '' } } : r));
        setSubmitError(null);
      }
    }
  };

  const parseClipboardData = (text: string): string[][] => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawLines = normalized.split('\n');
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }
    if (rawLines.length === 0) return [];

    const hasTabs = rawLines.some(l => l.includes('\t'));
    if (hasTabs) {
      return rawLines.map(line => line.split('\t'));
    }

    return rawLines.map(line => {
      const row: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(cur);
          cur = '';
        } else {
          cur += char;
        }
      }
      row.push(cur);
      return row;
    });
  };

  const handleCopySelection = () => {
    const existingCount = data?.values?.length || 0;
    const norm = getNormalizedRange();

    // 1. If range selection is active
    if (norm) {
      const isSingleCell = (norm.minRow === norm.maxRow) && (norm.minCol === norm.maxCol);
      const rowsText: string[] = [];

      for (let r = norm.minRow; r <= norm.maxRow; r++) {
        const rowVals: string[] = [];
        const isExisting = r < existingCount;
        const existingRow = isExisting && data ? data.values[r] : null;
        const stagedRow = !isExisting ? stagedInserts[r - existingCount] : null;

        for (let c = norm.minCol; c <= norm.maxCol; c++) {
          const colName = visibleColumns[c];
          let rawVal: any = '';

          if (isExisting && existingRow) {
            const cIdx = data!.columns.indexOf(colName);
            rawVal = cIdx !== -1 ? existingRow[cIdx] : null;
          } else if (stagedRow) {
            rawVal = stagedRow.values[colName] ?? '';
          }

          if (isSingleCell) {
            const textVal = rawVal === null ? 'NULL' : String(rawVal ?? '');
            navigator.clipboard.writeText(textVal);
            setCopyFeedback(`Copied cell: ${textVal.length > 25 ? textVal.slice(0, 25) + '...' : textVal}`);
            setTimeout(() => setCopyFeedback(null), 2000);
            return;
          }

          if (activeExtractor === 'TSV') {
            const str = rawVal === null ? 'NULL' : String(rawVal ?? '');
            rowVals.push(str.replace(/\t/g, ' ').replace(/\r?\n/g, ' '));
          } else {
            // Default: CSV formatting
            if (rawVal === null || rawVal === undefined) {
              rowVals.push('');
            } else {
              const str = String(rawVal);
              if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                rowVals.push(`"${str.replace(/"/g, '""')}"`);
              } else {
                rowVals.push(str);
              }
            }
          }
        }
        rowsText.push(rowVals.join(activeExtractor === 'TSV' ? '\t' : ','));
      }

      const outputText = rowsText.join('\n');
      navigator.clipboard.writeText(outputText);
      const numRows = norm.maxRow - norm.minRow + 1;
      const numCols = norm.maxCol - norm.minCol + 1;
      setCopyFeedback(`Copied ${numRows} × ${numCols} block (${activeExtractor})`);
      setTimeout(() => setCopyFeedback(null), 2000);
      return;
    }

    // 2. Fallback to single selected cell
    if (selectedCell) {
      let textToCopy = '';
      if (selectedCell.rowType === 'existing' && data?.values[selectedCell.rowIdx]) {
        const row = data.values[selectedCell.rowIdx];
        const cIdx = data.columns.indexOf(selectedCell.colName);
        const val = cIdx !== -1 ? row[cIdx] : null;
        textToCopy = val === null ? 'NULL' : String(val);
      } else if (selectedCell.rowType === 'staged' && selectedCell.tempId) {
        const staged = stagedInserts.find(r => r.tempId === selectedCell.tempId);
        const val = staged ? staged.values[selectedCell.colName] : '';
        textToCopy = val === undefined || val === null ? '' : String(val);
      }
      navigator.clipboard.writeText(textToCopy);
      setCopyFeedback(`Copied cell: ${textToCopy.length > 20 ? textToCopy.slice(0, 20) + '...' : textToCopy}`);
      setTimeout(() => setCopyFeedback(null), 2000);
      return;
    }

    // 3. Fallback to row
    if (selectedRowType === 'existing' && data?.values[selectedRowIndex]) {
      const row = data.values[selectedRowIndex];
      const sep = activeExtractor === 'TSV' ? '\t' : ',';
      const vals = visibleColumns.map(col => {
        const idx = data.columns.indexOf(col);
        const v = idx !== -1 ? row[idx] : null;
        return v === null ? 'NULL' : String(v);
      });
      navigator.clipboard.writeText(vals.join(sep));
      setCopyFeedback(`Row #${selectedRowIndex + 1} copied (${activeExtractor})`);
      setTimeout(() => setCopyFeedback(null), 2000);
    } else if (selectedRowType === 'staged' && selectedStagedTempId) {
      const staged = stagedInserts.find(r => r.tempId === selectedStagedTempId);
      if (staged) {
        const sep = activeExtractor === 'TSV' ? '\t' : ',';
        const vals = visibleColumns.map(col => staged.values[col] || '');
        navigator.clipboard.writeText(vals.join(sep));
        setCopyFeedback(`Copied staged row (${activeExtractor})`);
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    }
  };

  const handleCopyRowAsTsv = (rowIdx: number) => {
    if (!data || !data.values[rowIdx]) return;
    const row = data.values[rowIdx];
    const tsv = visibleColumns.map(col => {
      const idx = data.columns.indexOf(col);
      const v = idx !== -1 ? row[idx] : null;
      return v === null ? 'NULL' : String(v);
    }).join('\t');
    navigator.clipboard.writeText(tsv);
    setCopyFeedback(`Row #${rowIdx + 1} copied as TSV`);
    setContextMenu(null);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handlePasteSelection = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) return;

      const parsedMatrix = parseClipboardData(clipText);
      if (parsedMatrix.length === 0 || parsedMatrix[0].length === 0) return;

      const existingCount = data?.values?.length || 0;
      const norm = getNormalizedRange();

      let startRowIdx = 0;
      let startColIdx = 0;

      if (norm) {
        startRowIdx = norm.minRow;
        startColIdx = norm.minCol;
      } else if (selectedCell) {
        startColIdx = visibleColumns.indexOf(selectedCell.colName);
        if (startColIdx === -1) startColIdx = 0;
        if (selectedCell.rowType === 'staged' && selectedCell.tempId) {
          const sIdx = stagedInserts.findIndex(r => r.tempId === selectedCell.tempId);
          startRowIdx = existingCount + (sIdx !== -1 ? sIdx : 0);
        } else {
          startRowIdx = selectedCell.rowIdx;
        }
      } else if (selectedRowIndex >= 0) {
        startRowIdx = selectedRowIndex;
        startColIdx = 0;
      }

      // If user selected a range larger than 1x1, fill the target range (repeating modulo clipboard rows/cols)
      const isMultiCellRange = Boolean(norm && (norm.minRow !== norm.maxRow || norm.minCol !== norm.maxCol));
      const targetRowCount = isMultiCellRange && norm 
        ? (norm.maxRow - norm.minRow + 1) 
        : parsedMatrix.length;
      const targetColCount = isMultiCellRange && norm 
        ? (norm.maxCol - norm.minCol + 1) 
        : Math.max(...parsedMatrix.map(r => r.length));

      const pkColIdx = data ? data.columns.indexOf(primaryKeyCol) : -1;
      let updatedExistingValues = data ? data.values.map(r => [...r]) : [];
      let updatedStagedInserts = stagedInserts.map(r => ({ ...r, values: { ...r.values }, hasError: false }));
      let newPendingEdits: PendingCellEdit[] = [...pendingEdits];

      for (let rOffset = 0; rOffset < targetRowCount; rOffset++) {
        const targetRowIdx = startRowIdx + rOffset;
        const srcRow = parsedMatrix[rOffset % parsedMatrix.length];

        if (targetRowIdx < existingCount && data) {
          const pkVal = pkColIdx !== -1 ? data.values[targetRowIdx][pkColIdx] : null;
          for (let cOffset = 0; cOffset < targetColCount; cOffset++) {
            const targetColIdx = startColIdx + cOffset;
            if (targetColIdx < visibleColumns.length) {
              const colName = visibleColumns[targetColIdx];
              const realColIdx = data.columns.indexOf(colName);
              const cellVal = srcRow[cOffset % srcRow.length];
              const cleanVal = cellVal !== undefined ? cellVal.trim() : '';
              const originalVal = data.values[targetRowIdx][realColIdx];
              const finalVal = cleanVal === 'NULL' || cleanVal === '<null>' ? null : cleanVal;

              newPendingEdits = newPendingEdits.filter(p => !(p.rowIdx === targetRowIdx && p.colName === colName));
              if (String(originalVal) !== String(finalVal)) {
                newPendingEdits.push({
                  rowIdx: targetRowIdx,
                  pkVal,
                  colName,
                  originalVal,
                  newVal: finalVal,
                });
              }
              updatedExistingValues[targetRowIdx][realColIdx] = finalVal;
            }
          }
        } else {
          // Staged rows: ensure row exists at stagedIdx
          const stagedIdx = targetRowIdx - existingCount;
          while (updatedStagedInserts.length <= stagedIdx) {
            const tempId = 'staged_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + updatedStagedInserts.length;
            const initialValues: Record<string, string> = {};
            visibleColumns.forEach(c => { initialValues[c] = ''; });
            updatedStagedInserts.push({ tempId, values: initialValues, hasError: false });
          }

          for (let cOffset = 0; cOffset < targetColCount; cOffset++) {
            const targetColIdx = startColIdx + cOffset;
            if (targetColIdx < visibleColumns.length) {
              const colName = visibleColumns[targetColIdx];
              const cellVal = srcRow[cOffset % srcRow.length];
              const cleanVal = cellVal !== undefined ? cellVal.trim() : '';
              updatedStagedInserts[stagedIdx].values[colName] = cleanVal;
            }
          }
        }
      }

      if (data && updatedExistingValues.length > 0) {
        setData({ ...data, values: updatedExistingValues });
      }
      setPendingEdits(newPendingEdits);
      setStagedInserts(updatedStagedInserts);
      setSubmitError(null);

      const endRowIdx = startRowIdx + targetRowCount - 1;
      const endColIdx = Math.min(visibleColumns.length - 1, startColIdx + targetColCount - 1);
      setSelectionRange({
        start: { rowIdx: startRowIdx, colIdx: startColIdx },
        end: { rowIdx: endRowIdx, colIdx: endColIdx }
      });

      setContextMenu(null);
      setCopyFeedback(`Pasted ${targetRowCount} row(s) × ${targetColCount} col(s) into table`);
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch (err: any) {
      console.error('Failed to paste from clipboard', err);
      setCopyFeedback('Clipboard access failed or empty');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  return (
    <div className="grid-suite-container">
      {/* Action Toolbar */}
      <div className="grid-toolbar">
        <div className="grid-toolbar-left">
          {/* Refresh Button (↺) */}
          <button 
            className="dg-tool-btn"
            onClick={handleRefreshClick}
            title="Reload Page (⌘R)"
          >
            <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
          </button>

          {/* Stop / Cancel Button (⏹) */}
          <button 
            className="dg-tool-btn"
            onClick={() => setLoading(false)}
            disabled={!loading}
            title="Stop Query Execution"
          >
            <Square size={12} fill="currentColor" />
          </button>

          {/* Add Row Button (+) */}
          <button 
            className="dg-tool-btn"
            onClick={handleAddNewRow}
            title="Add Row (⌘N)"
          >
            <Plus size={14} />
          </button>

          {/* Delete Row Button (-) */}
          <button 
            className="dg-tool-btn"
            onClick={handleDeleteRowAction}
            disabled={(!data || data.values.length === 0) && stagedInserts.length === 0}
            title="Delete Row (⌘⌫)"
          >
            <Minus size={14} />
          </button>

          {/* Clone / Duplicate Row Button */}
          <button 
            className="dg-tool-btn"
            onClick={() => {
              if (selectedRowType === 'existing' && selectedRowIndex >= 0) {
                handleCloneRow(selectedRowIndex);
              }
            }}
            disabled={!data || data.values.length === 0}
            title="Duplicate / Clone Selected Row (⌘D)"
          >
            <CopyCheck size={14} />
          </button>

          {/* Copy Cell/Row Button */}
          <button 
            className="dg-tool-btn"
            onClick={handleCopySelection}
            disabled={(!data || data.values.length === 0) && stagedInserts.length === 0}
            title="Copy Cell or Row (⌘C)"
          >
            <Copy size={13} />
          </button>

          {/* Paste into Table Button */}
          <button 
            className="dg-tool-btn"
            onClick={handlePasteSelection}
            title="Paste from Clipboard into Table (⌘V)"
          >
            <Clipboard size={13} />
          </button>

          {/* Revert Changes Button (↺) */}
          <button 
            className={`dg-tool-btn btn-revert ${totalPendingChanges > 0 ? 'active' : ''}`}
            onClick={handleRevertAction}
            disabled={totalPendingChanges === 0}
            title="Revert Selected / Uncommitted Changes (⌘Z)"
          >
            <Undo2 size={13} />
          </button>

          {/* Submit / Commit Changes Button (⬆) */}
          <button 
            className={`dg-tool-btn btn-submit ${totalPendingChanges > 0 ? 'active' : ''}`}
            onClick={handleSubmitAllChanges}
            disabled={totalPendingChanges === 0 || isSubmittingAll}
            title="Submit All Staged Changes (⌘⏎)"
          >
            <ArrowUp size={14} />
            {totalPendingChanges > 0 && (
              <span className="dg-badge">{totalPendingChanges}</span>
            )}
          </button>

          {/* Transaction Mode Dropdown: Tx: Auto / Tx: Manual */}
          <div style={{ position: 'relative' }}>
            <button 
              className="dg-tx-dropdown-btn"
              onClick={() => setShowTxMenu(!showTxMenu)}
              title="Transaction Isolation Mode"
            >
              <span>Tx: {txMode === 'auto' ? 'Auto' : 'Manual'}</span>
              <ChevronDown size={11} />
            </button>
            {showTxMenu && (
              <div className="dg-dropdown-popover" style={{ left: 0 }}>
                <button 
                  className={`dg-dropdown-item ${txMode === 'auto' ? 'is-active' : ''}`}
                  onClick={() => { setTxMode('auto'); setShowTxMenu(false); }}
                >
                  <span>Auto (Commit on submit)</span>
                  {txMode === 'auto' && <Check size={12} />}
                </button>
                <button 
                  className={`dg-dropdown-item ${txMode === 'manual' ? 'is-active' : ''}`}
                  onClick={() => { setTxMode('manual'); setShowTxMenu(false); }}
                >
                  <span>Manual Transaction</span>
                  {txMode === 'manual' && <Check size={12} />}
                </button>
              </div>
            )}
          </div>

          {/* DDL Button */}
          <button 
            className="dg-tool-btn btn-text"
            onClick={() => setShowDdlModal(true)}
            title="Show Table DDL (CREATE TABLE script)"
          >
            <span>DDL</span>
          </button>

          {/* Find in Table Button (🔍) */}
          <button 
            className={`dg-tool-btn ${showFindBar ? 'active' : ''}`}
            onClick={() => { setShowFindBar(!showFindBar); if (!showFindBar) setFindText(''); }}
            title="Find Text in Table (⌘F)"
          >
            <Search size={13} />
          </button>

          {/* Compare / Structure Button (🗂) */}
          <button 
            className="dg-tool-btn"
            onClick={() => setShowCompareModal(true)}
            title="Compare Structure / Diff"
          >
            <GitCompare size={13} />
          </button>

          {/* Quick Chart Visualizer (📊) */}
          <button 
            className="dg-tool-btn"
            onClick={() => setShowChartModal(true)}
            title="Visualize Table Data (Charts)"
          >
            <BarChart3 size={13} />
          </button>
        </div>

        <div className="grid-toolbar-right">
          {/* Data Extractor Dropdown: CSV, TSV, JSON, SQL, Markdown, HTML */}
          <div style={{ position: 'relative' }}>
            <button 
              className="dg-extractor-btn"
              onClick={() => setShowExtractorMenu(!showExtractorMenu)}
              title="Select Active Data Extractor Format"
            >
              <span>{activeExtractor}</span>
              <ChevronDown size={11} />
            </button>
            {showExtractorMenu && (
              <div className="dg-dropdown-popover" style={{ right: 0 }}>
                {(['CSV', 'TSV', 'JSON', 'SQL', 'Markdown', 'HTML'] as const).map(fmt => (
                  <button 
                    key={fmt} 
                    className={`dg-dropdown-item ${activeExtractor === fmt ? 'is-active' : ''}`}
                    onClick={() => { setActiveExtractor(fmt); setShowExtractorMenu(false); }}
                  >
                    <span>{fmt === 'SQL' ? 'SQL Inserts' : fmt}</span>
                    {activeExtractor === fmt && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export to File Button (⬇) */}
          <button 
            className="dg-tool-btn"
            onClick={handleExportWithExtractor}
            title={`Export Data to ${activeExtractor} File`}
          >
            <Download size={13} />
          </button>

          {/* Import Data Button (⬆) */}
          <button 
            className="dg-tool-btn"
            onClick={() => {
              setCopyFeedback('Drag and drop CSV/SQL file or paste to import');
              setTimeout(() => setCopyFeedback(null), 3000);
            }}
            title="Import Data from File / Clipboard"
          >
            <Upload size={13} />
          </button>

          <div className="dg-toolbar-divider"></div>

          {/* Settings Button (⚙) */}
          <div style={{ position: 'relative' }}>
            <button 
              className="dg-tool-btn"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="Data Editor Settings"
            >
              <Settings size={13} />
            </button>
            {showSettingsMenu && (
              <div className="dg-dropdown-popover" style={{ right: 0, minWidth: '170px' }}>
                <button 
                  className="dg-dropdown-item"
                  onClick={() => {
                    setShowConsole(!showConsole);
                    setShowSettingsMenu(false);
                  }}
                >
                  <span>{showConsole ? 'Hide Services Console' : 'Show Services Console'}</span>
                </button>
                <button 
                  className="dg-dropdown-item"
                  onClick={() => {
                    setShowDmlModal(true);
                    setShowSettingsMenu(false);
                  }}
                >
                  <span>Preview DML Statements</span>
                </button>
              </div>
            )}
          </div>

          {/* Columns Visibility Button (👁) */}
          <button 
            className="dg-tool-btn"
            onClick={() => setShowColModal(true)}
            title="Show / Hide Columns"
          >
            <Eye size={13} />
          </button>
        </div>

        {copyFeedback && (
          <div className="copy-feedback-pill">
            <CheckCircle2 size={12} />
            <span>{copyFeedback}</span>
          </div>
        )}
      </div>

      {/* In-Table Find Bar (Shown when Search is toggled) */}
      {showFindBar && (
        <div className="grid-find-bar">
          <div className="grid-find-input-wrap">
            <Search size={13} style={{ color: '#8c919b' }} />
            <input 
              autoFocus
              type="text"
              className="grid-find-input"
              value={findText}
              onChange={e => setFindText(e.target.value)}
              placeholder="Find in table..."
            />
            {findText.trim() && (
              <span className="find-match-counter">
                {data?.values?.reduce((acc, row) => acc + row.filter(v => String(v ?? '').toLowerCase().includes(findText.toLowerCase().trim())).length, 0) || 0} matches
              </span>
            )}
          </div>
          <button 
            className="dg-tool-btn" 
            onClick={() => { setShowFindBar(false); setFindText(''); }}
            title="Close Find"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* WHERE & ORDER BY Clause Filter Strip */}
      <div className="grid-query-bar">
        <form onSubmit={handleQuerySubmit} className="query-field-group where-group">
          <div className="query-label">
            <Filter size={12} className="query-icon" />
            <span>WHERE</span>
          </div>
          <input 
            type="text"
            className="query-input"
            value={whereText}
            onChange={e => setWhereText(e.target.value)}
            placeholder="e.g. status = 'active' AND id > 5"
            title="Enter SQL WHERE clause and press Enter"
            spellCheck={false}
          />
          {whereText && (
            <button 
              type="button" 
              className="query-clear-btn"
              onClick={() => {
                setWhereText('');
                setPage(0);
                setTimeout(() => loadData(), 0);
              }}
              title="Clear WHERE clause"
            >
              ×
            </button>
          )}
        </form>

        <div className="query-divider"></div>

        <form onSubmit={handleQuerySubmit} className="query-field-group order-group">
          <div className="query-label">
            <ArrowDownWideNarrow size={12} className="query-icon" />
            <span>ORDER BY</span>
          </div>
          <input 
            type="text"
            className="query-input"
            value={orderByText}
            onChange={e => setOrderByText(e.target.value)}
            placeholder="e.g. created_at DESC, id ASC"
            title="Enter SQL ORDER BY clause and press Enter"
            spellCheck={false}
          />
          {orderByText && (
            <button 
              type="button" 
              className="query-clear-btn"
              onClick={() => {
                setOrderByText('');
                setSortCol(null);
                setPage(0);
                setTimeout(() => loadData(), 0);
              }}
              title="Clear ORDER BY clause"
            >
              ×
            </button>
          )}
        </form>
      </div>

      {/* Main Split View: Table Container + Console Output */}
      <div className="grid-split-viewport">
        <div className="grid-table-container">
          <div className="table-wrapper">
            <table className="data-table" style={{ userSelect: isDraggingRange ? 'none' : 'auto' }}>
              <thead>
                <tr>
                  <th className="th-row-num">#</th>
                  {visibleColumns.map(col => {
                    const colDef = schema?.columns?.find(c => c.name === col);
                    const isSorted = sortCol === col;
                    const isRequiredCol = Boolean(colDef?.notNull && !colDef?.defaultValue && !colDef?.autoIncrement && !colDef?.primaryKey);

                    return (
                      <th 
                        key={col} 
                        className={`th-data-col ${isSorted ? 'sorted' : ''}`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredColTooltip({
                            colName: col,
                            colType: colDef?.type || 'VARCHAR(255)',
                            x: rect.left + rect.width / 2,
                            y: rect.top - 24,
                          });
                        }}
                        onMouseLeave={() => setHoveredColTooltip(null)}
                      >
                        <div className="th-header-cell-inner">
                          <div className="th-header-left" onClick={() => handleSort(col)}>
                            {colDef?.primaryKey ? (
                              <span title="Primary Key"><Key size={12} className="pk-icon" /></span>
                            ) : (
                              <span className="col-type-tag">{colDef?.type || 'TEXT'}</span>
                            )}
                            <span className="col-name">{col}</span>
                            {isRequiredCol && (
                              <span className="col-required-star" title="Required field">*</span>
                            )}
                          </div>

                          <div className="th-header-right-tools">
                            {/* Column Filter Funnel Button */}
                            <button 
                              type="button"
                              className={`th-filter-btn ${whereText.includes(col) ? 'is-filtered' : ''}`}
                              title={`Filter by ${col}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setColFilterPopover({
                                  colName: col,
                                  x: Math.min(window.innerWidth - 280, Math.max(10, rect.left - 100)),
                                  y: rect.bottom + 4,
                                });
                                setColFilterVal('');
                              }}
                            >
                              <Filter size={10} />
                            </button>

                            {/* Sort Arrow Indicator */}
                            <span className={`th-sort-arrows ${isSorted ? 'is-sorted' : ''}`} onClick={() => handleSort(col)}>
                              {isSorted ? (sortOrder === 'ASC' ? '▲' : '▼') : '⇅'}
                            </span>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* 1. Existing Rows in Table */}
                {!data || data.values.length === 0 ? (
                  stagedInserts.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="td-empty">
                        No data records found. Press + or ⌘N to add a row.
                      </td>
                    </tr>
                  )
                ) : (
                  data.values.map((row, rIdx) => {
                    const isSelected = selectedRowType === 'existing' && selectedRowIndex === rIdx;
                    const pkColIdx = data.columns.indexOf(primaryKeyCol);
                    const pkVal = pkColIdx !== -1 ? row[pkColIdx] : null;
                    const isDeleted = pkVal !== null && stagedDeletes.has(pkVal);
                    const hasAnyPendingEditInRow = pendingEdits.some(p => p.rowIdx === rIdx);

                    return (
                      <tr 
                        key={rIdx} 
                        className={`data-row ${isSelected ? 'row-selected' : ''} ${isDeleted ? 'row-staged-deleted' : ''}`}
                        onClick={() => {
                          setSelectedRowType('existing');
                          setSelectedRowIndex(rIdx);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedRowType('existing');
                          setSelectedRowIndex(rIdx);
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            rowIdx: rIdx,
                            colName: visibleColumns[0]
                          });
                        }}
                      >
                        {/* Row Gutter (Number or Deleted/Edited Indicator) */}
                        <td 
                          className="td-row-num" 
                          title={isDeleted ? "Marked for deletion (Submit to delete, Revert to restore)" : `Row #${page * pageSize + rIdx + 1}`}
                          onMouseDown={(e) => handleGutterMouseDown(e, rIdx)}
                          onMouseEnter={() => handleGutterMouseEnter(rIdx)}
                        >
                          {isDeleted ? (
                            <span className="gutter-deleted-icon">−</span>
                          ) : (
                            <>
                              <span>{page * pageSize + rIdx + 1}</span>
                              {hasAnyPendingEditInRow && <span className="gutter-edited-dot">●</span>}
                            </>
                          )}
                        </td>

                        {/* Data Cells */}
                        {visibleColumns.map((col, colIdx) => {
                          const cIdx = data.columns.indexOf(col);
                          const val = cIdx !== -1 ? row[cIdx] : null;
                          const isEditing = editingCell?.rowIdx === rIdx && editingCell?.colName === col;
                          const hasPendingEdit = pendingEdits.some(p => p.rowIdx === rIdx && p.colName === col);
                          const colDef = schema?.columns?.find(c => c.name === col);
                          const isMatch = Boolean(findText.trim() && String(val ?? '').toLowerCase().includes(findText.toLowerCase().trim()));
                          const isCellSelected = selectedCell?.rowType === 'existing' && selectedCell?.rowIdx === rIdx && selectedCell?.colName === col;
                          const rangeClasses = getCellRangeClasses(rIdx, colIdx);

                          return (
                            <td 
                              key={col} 
                              className={`td-data-cell ${rangeClasses} ${isCellSelected ? 'cell-selected' : ''} ${val === null ? 'null-val' : ''} ${hasPendingEdit ? 'cell-staged-updated' : ''} ${isMatch ? 'cell-find-highlight' : ''}`}
                              onMouseDown={(e) => handleCellMouseDown(e, rIdx, colIdx, 'existing')}
                              onMouseEnter={() => handleCellMouseEnter(rIdx, colIdx)}
                              onDoubleClick={() => handleStartEdit(rIdx, col, val)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCellMouseDown(e, rIdx, colIdx, 'existing');
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  rowIdx: rIdx,
                                  colName: col
                                });
                              }}
                            >
                              {isEditing ? (
                                isTemporalColumn(colDef?.type) ? (
                                  <div className="cell-picker-wrapper">
                                    <input 
                                      type="text"
                                      autoFocus
                                      value={editValue}
                                      onMouseDown={e => e.stopPropagation()}
                                      onChange={e => setEditValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleStageEdit(rIdx, col);
                                        if (e.key === 'Escape') setEditingCell(null);
                                        if (e.key === 'Tab') {
                                          e.preventDefault();
                                          handleStageEdit(rIdx, col);
                                          const curIdx = visibleColumns.indexOf(col);
                                          if (e.shiftKey) {
                                            if (curIdx > 0) {
                                              const prevCol = visibleColumns[curIdx - 1];
                                              handleStartEdit(rIdx, prevCol, row[data.columns.indexOf(prevCol)]);
                                            }
                                          } else {
                                            if (curIdx < visibleColumns.length - 1) {
                                              const nextCol = visibleColumns[curIdx + 1];
                                              handleStartEdit(rIdx, nextCol, row[data.columns.indexOf(nextCol)]);
                                            }
                                          }
                                        }
                                      }}
                                      onBlur={() => {
                                        if (activePicker?.target === 'existing') return;
                                        handleStageEdit(rIdx, col);
                                      }}
                                      className="cell-input"
                                    />
                                    <button
                                      type="button"
                                      className={`btn-cell-picker-trigger ${activePicker?.target === 'existing' && activePicker?.rowKey === rIdx && activePicker?.colName === col ? 'active' : ''}`}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setActivePicker({
                                          target: 'existing',
                                          rowKey: rIdx,
                                          colName: col,
                                          anchorRect: rect
                                        });
                                      }}
                                      title="Open Date / Time Picker"
                                    >
                                      ...
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-editor">
                                    <input 
                                      type="text"
                                      autoFocus
                                      value={editValue}
                                      onMouseDown={e => e.stopPropagation()}
                                      onChange={e => setEditValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleStageEdit(rIdx, col);
                                        if (e.key === 'Escape') setEditingCell(null);
                                        if (e.key === 'Tab') {
                                          e.preventDefault();
                                          handleStageEdit(rIdx, col);
                                          const curIdx = visibleColumns.indexOf(col);
                                          if (e.shiftKey) {
                                            if (curIdx > 0) {
                                              const prevCol = visibleColumns[curIdx - 1];
                                              handleStartEdit(rIdx, prevCol, row[data.columns.indexOf(prevCol)]);
                                            }
                                          } else {
                                            if (curIdx < visibleColumns.length - 1) {
                                              const nextCol = visibleColumns[curIdx + 1];
                                              handleStartEdit(rIdx, nextCol, row[data.columns.indexOf(nextCol)]);
                                            }
                                          }
                                        }
                                      }}
                                      onBlur={() => handleStageEdit(rIdx, col)}
                                      className="cell-input"
                                    />
                                  </div>
                                )
                              ) : (
                                <span className={`cell-display ${val === null ? 'is-null' : ''} ${isNumericColumnOrValue(val, colDef?.type) ? 'is-number' : ''}`}>
                                  {val === null ? '<null>' : String(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}

                {/* 2. Staged Inserted Rows (Green Highlight Rows, Red on error) */}
                {stagedInserts.map((insertRow, insertIdx) => {
                  const isSelected = selectedRowType === 'staged' && selectedStagedTempId === insertRow.tempId;
                  const rowDisplayNum = (data?.values?.length || 0) + insertIdx + 1;
                  const hasErrorRow = Boolean(submitError || insertRow.hasError);

                  return (
                    <tr 
                      key={insertRow.tempId}
                      className={`data-row row-staged-inserted ${hasErrorRow ? 'row-staged-error' : ''} ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => {
                        setSelectedRowType('staged');
                        setSelectedStagedTempId(insertRow.tempId);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedRowType('staged');
                        setSelectedStagedTempId(insertRow.tempId);
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          rowIdx: rowDisplayNum - 1,
                          colName: visibleColumns[0]
                        });
                      }}
                    >
                      <td 
                        className="td-row-num" 
                        title="Staged new row (Submit to apply)"
                        onMouseDown={(e) => handleGutterMouseDown(e, (data?.values?.length || 0) + insertIdx)}
                        onMouseEnter={() => handleGutterMouseEnter((data?.values?.length || 0) + insertIdx)}
                      >
                        <span>{rowDisplayNum}</span>
                      </td>

                      {visibleColumns.map((col, colIdx) => {
                        const unifiedRowIdx = (data?.values?.length || 0) + insertIdx;
                        const isFocused = activeInsertTempId === insertRow.tempId && activeInsertCol === col;
                        const val = insertRow.values[col];
                        const colDef = schema?.columns?.find(c => c.name === col);
                        const isAutoInc = Boolean(
                          colDef?.autoIncrement || 
                          (colDef?.primaryKey && (!colDef?.type || /int/i.test(colDef.type))) ||
                          col.toLowerCase() === 'id'
                        );
                        const hasDefault = Boolean(colDef?.defaultValue !== undefined && colDef?.defaultValue !== null && colDef?.defaultValue !== '');
                        const isRequiredCol = Boolean(colDef?.notNull && !hasDefault && !isAutoInc && !colDef?.primaryKey);
                        const isMissingThis = missingRequiredCols.has(col);
                        const isTemp = isTemporalColumn(colDef?.type);
                        const hasVal = val !== undefined && val !== '' && val !== '<null>' && val !== '<default>' && val !== '<generated>';
                        const isNum = isNumericColumnOrValue(val, colDef?.type);
                        const isMatch = Boolean(findText.trim() && String(val ?? '').toLowerCase().includes(findText.toLowerCase().trim()));
                        const isCellSelected = selectedCell?.rowType === 'staged' && 
                                               selectedCell?.tempId === insertRow.tempId && 
                                               selectedCell?.colName === col;
                        const rangeClasses = getCellRangeClasses(unifiedRowIdx, colIdx);

                        return (
                          <td 
                            key={col}
                            className={`td-data-cell new-row-cell ${rangeClasses} ${isCellSelected ? 'cell-selected' : ''} ${isFocused ? 'cell-focused-insert' : ''} ${insertRow.hasError && isMissingThis && !hasVal ? 'cell-missing-required' : ''} ${isMatch ? 'cell-find-highlight' : ''}`}
                            onMouseDown={(e) => handleCellMouseDown(e, unifiedRowIdx, colIdx, 'staged', insertRow.tempId)}
                            onMouseEnter={() => handleCellMouseEnter(unifiedRowIdx, colIdx)}
                            onDoubleClick={() => {
                              setActiveInsertTempId(insertRow.tempId);
                              setActiveInsertCol(col);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCellMouseDown(e, unifiedRowIdx, colIdx, 'staged', insertRow.tempId);
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                rowIdx: rowDisplayNum - 1,
                                colName: col,
                                isStagedInsert: true,
                                tempId: insertRow.tempId,
                              });
                            }}
                          >
                            {isFocused ? (
                              isTemp ? (
                                <div className="cell-picker-wrapper">
                                  <input 
                                    autoFocus
                                    type="text"
                                    value={val ?? ''}
                                    placeholder={isDateColumn(colDef?.type) ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'}
                                    onMouseDown={e => e.stopPropagation()}
                                    onChange={e => {
                                      handleUpdateStagedInsertValue(insertRow.tempId, col, e.target.value);
                                    }}
                                    onBlur={() => {
                                      if (activePicker?.target === 'staged') return;
                                      setActiveInsertCol(null);
                                    }}
                                    onKeyDown={e => handleStagedCellKeyDown(e, insertRow.tempId, col, insertIdx)}
                                    className="new-row-cell-input"
                                  />
                                  <button
                                    type="button"
                                    className={`btn-cell-picker-trigger ${activePicker?.target === 'staged' && activePicker?.rowKey === insertRow.tempId && activePicker?.colName === col ? 'active' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setActivePicker({
                                        target: 'staged',
                                        rowKey: insertRow.tempId,
                                        colName: col,
                                        anchorRect: rect
                                      });
                                    }}
                                    title="Open Date / Time Picker"
                                  >
                                    ...
                                  </button>
                                </div>
                              ) : (
                                <input 
                                  autoFocus
                                  type="text"
                                  value={val ?? ''}
                                  placeholder={isAutoInc ? '<generated>' : hasDefault ? '<default>' : '<null>'}
                                  onMouseDown={e => e.stopPropagation()}
                                  onChange={e => {
                                    handleUpdateStagedInsertValue(insertRow.tempId, col, e.target.value);
                                  }}
                                  onBlur={() => {
                                    setActiveInsertCol(null);
                                  }}
                                  onKeyDown={e => handleStagedCellKeyDown(e, insertRow.tempId, col, insertIdx)}
                                  className="new-row-cell-input"
                                />
                              )
                            ) : (
                              hasVal ? (
                                <span className={`cell-display has-val ${isNum ? 'is-number' : ''}`}>{val}</span>
                              ) : isAutoInc ? (
                                <span className="cell-display is-generated">&lt;generated&gt;</span>
                              ) : hasDefault ? (
                                <span className="cell-display is-default">&lt;default&gt;</span>
                              ) : (
                                <span className={`cell-display is-null ${isRequiredCol ? 'is-required' : ''}`}>
                                  &lt;null&gt;
                                </span>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Docked Bottom Error Banner */}
            {submitError && (
              <div className="grid-bottom-error-banner">
                <div className="dg-error-msg" title={submitError.message}>
                  <span>{submitError.message}</span>
                </div>
                <div className="dg-error-actions">
                  <a className="dg-error-link" onClick={() => setShowDmlModal(true)}>
                    Details
                  </a>
                  {submitError.rowNumber !== undefined && (
                    <a className="dg-error-link" onClick={handleJumpToErrorRow}>
                      [row:{submitError.rowNumber}]
                    </a>
                  )}
                  <button className="dg-error-close" onClick={() => setSubmitError(null)} title="Dismiss">
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Pagination Pill (docked at bottom-right of table) */}
          <div className="grid-floating-pagination">
            <button 
              className="dg-page-nav-btn" 
              onClick={() => setPage(0)}
              disabled={page === 0}
              title="First Page"
            >
              <ChevronsLeft size={13} />
            </button>
            <button 
              className="dg-page-nav-btn" 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              title="Previous Page"
            >
              <ChevronLeft size={13} />
            </button>
            <div 
              className="dg-page-range-label"
              onClick={() => setShowPageMenu(!showPageMenu)}
              title="Click to select rows per page"
            >
              {data && data.values.length > 0 ? page * pageSize + 1 : 0}-{page * pageSize + (data?.values?.length || 0)} of {filteredRowCount !== null ? `${filteredRowCount} (filtered)` : (schema?.rowCount ?? data?.values?.length ?? 0)}
            </div>
            <button 
              className="dg-page-nav-btn" 
              onClick={() => setPage(p => p + 1)}
              disabled={!data || data.values.length < pageSize}
              title="Next Page"
            >
              <ChevronRight size={13} />
            </button>
            <button 
              className="dg-page-nav-btn" 
              onClick={() => {
                const total = filteredRowCount !== null ? filteredRowCount : (schema?.rowCount ?? data?.values?.length ?? 0);
                setPage(Math.max(0, Math.ceil(total / pageSize) - 1));
              }}
              disabled={!data || data.values.length < pageSize}
              title="Last Page"
            >
              <ChevronsRight size={13} />
            </button>
            <button 
              className="dg-page-nav-btn"
              onClick={() => setShowPageMenu(!showPageMenu)}
              title="More Pagination Options"
            >
              <MoreVertical size={12} />
            </button>

            {showPageMenu && (
              <div className="dg-dropdown-popover" style={{ bottom: '100%', right: 0, marginBottom: '6px' }}>
                {[10, 25, 50, 100, 500, 1000].map(sz => (
                  <button 
                    key={sz} 
                    className={`dg-dropdown-item ${pageSize === sz ? 'is-active' : ''}`}
                    onClick={() => {
                      setPageSize(sz);
                      setPage(0);
                      setShowPageMenu(false);
                    }}
                  >
                    <span>{sz} rows</span>
                    {pageSize === sz && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Staged Changes Status Banner */}
          {totalPendingChanges > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '16px',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(30, 31, 34, 0.94)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #3e6b48',
              borderRadius: '6px',
              padding: '3px 10px',
              fontSize: '11px',
              color: '#88cfa0',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 600,
            }}>
              <span>{totalPendingChanges} change{totalPendingChanges > 1 ? 's' : ''} staged</span>
              <button 
                style={{ background: '#3e6b48', border: 'none', color: '#fff', borderRadius: '3px', padding: '1px 6px', fontSize: '10px', cursor: 'pointer' }}
                onClick={handleSubmitAllChanges}
              >
                Submit (⌘⏎)
              </button>
            </div>
          )}
        </div>

        {/* Split Resizer Divider */}
        {showConsole && (
          <div 
            className={`grid-split-resizer ${isDraggingConsole ? 'is-dragging' : ''}`}
            onMouseDown={handleResizerMouseDown}
            title="Drag to resize console pane"
          />
        )}

        {/* Output Console Pane (Services / Query Execution Log) */}
        {showConsole && (
          <div className="grid-output-console" style={{ height: `${consoleHeight}px` }}>
            <div className="grid-console-body" ref={consoleBodyRef}>
              {executionLogs.map(log => (
                <div key={log.id} className="dg-log-entry">
                  <div className="dg-log-line">
                    <span className="dg-log-time">[{log.timestamp}]</span> Connected
                  </div>
                  <div className="dg-log-line">
                    <span className="dg-log-prompt">{log.databaseName}&gt;</span> use {log.databaseName}
                  </div>
                  <div className="dg-log-line">
                    <span className="dg-log-time">[{log.timestamp}]</span> completed in 1 ms
                  </div>
                  <div className="dg-log-line">
                    <span className="dg-log-prompt">{log.databaseName}&gt;</span> {renderHighlightedSql(log.sql)}
                  </div>
                  <div className="dg-log-line dg-log-summary">
                    <span className="dg-log-time">[{log.timestamp}]</span> {log.summary}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-console-tools">
              <button 
                className="dg-console-tool-btn" 
                onClick={() => setExecutionLogs([])}
                title="Clear Output"
              >
                <Trash2 size={13} />
              </button>
              <button 
                className="dg-console-tool-btn" 
                onClick={() => {
                  if (consoleBodyRef.current) {
                    consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
                  }
                }}
                title="Scroll to End"
              >
                <ChevronDown size={13} />
              </button>
              <button 
                className="dg-console-tool-btn" 
                onClick={() => {
                  const allText = executionLogs.map(l => `[${l.timestamp}] ${l.databaseName}> ${l.sql}\n[${l.timestamp}] ${l.summary}`).join('\n\n');
                  navigator.clipboard.writeText(allText);
                  setCopyFeedback('Console logs copied');
                  setTimeout(() => setCopyFeedback(null), 2000);
                }}
                title="Copy Console Logs"
              >
                <Copy size={13} />
              </button>
              <button 
                className="dg-console-tool-btn" 
                onClick={() => setShowConsole(false)}
                title="Hide Console Pane"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar at Bottom */}
      <div className="grid-status-bar">
        <div className="dg-status-stats">
          Execution: {execStats.execMs} ms, fetching: {execStats.fetchMs} ms
        </div>
        <div className="dg-status-actions">
          <button 
            className="dg-status-btn"
            onClick={() => setShowConsole(!showConsole)}
            title={showConsole ? 'Hide Console (Services)' : 'Show Console (Services)'}
          >
            <Terminal size={12} />
          </button>
          <span title="Table View Active"><Eye size={12} /></span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="grid-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="dg-menu-item" onClick={handleAddNewRow}>
            <span className="dg-item-label"><Plus size={13} /> Add Row</span>
            <span className="dg-item-shortcut">⌘N</span>
          </button>
          <button className="dg-menu-item" onClick={() => handleCloneRow(contextMenu.rowIdx)}>
            <span className="dg-item-label"><CopyCheck size={13} /> Clone Row</span>
            <span className="dg-item-shortcut">⌘D</span>
          </button>
          <button className="dg-menu-item" onClick={() => handleToggleDeleteRow(contextMenu.rowIdx)}>
            <span className="dg-item-label"><Minus size={13} /> Delete Row / Undelete</span>
            <span className="dg-item-shortcut">⌘⌫</span>
          </button>
          <button className="dg-menu-item" onClick={handleRevertSelected}>
            <span className="dg-item-label"><Undo2 size={13} /> Revert Changes</span>
            <span className="dg-item-shortcut">⌘Z</span>
          </button>

          <div className="dg-menu-separator"></div>

          <button className="dg-menu-item" onClick={handleCopySelection}>
            <span className="dg-item-label"><Copy size={13} /> Copy Selection</span>
            <span className="dg-item-shortcut">⌘C</span>
          </button>
          <button className="dg-menu-item" onClick={() => handleCopyRowAsTsv(contextMenu.rowIdx)}>
            <span className="dg-item-label"><Copy size={13} /> Copy Row as TSV</span>
          </button>
          <button className="dg-menu-item" onClick={handlePasteSelection}>
            <span className="dg-item-label"><Clipboard size={13} /> Paste</span>
            <span className="dg-item-shortcut">⌘V</span>
          </button>

          <div className="dg-menu-separator"></div>

          <button className="dg-menu-item" onClick={() => handleSetNull(contextMenu.rowIdx, contextMenu.colName)}>
            <span className="dg-item-label">Set to NULL</span>
          </button>
          <button className="dg-menu-item" onClick={() => handleSetEmptyString(contextMenu.rowIdx, contextMenu.colName)}>
            <span className="dg-item-label">Set to Empty String</span>
          </button>

          <div className="dg-menu-separator"></div>

          <button className="dg-menu-item" onClick={() => { setShowDmlModal(true); setContextMenu(null); }}>
            <span className="dg-item-label"><Code2 size={13} /> Preview DML...</span>
          </button>
          <button className="dg-menu-item" onClick={handleSubmitAllChanges} disabled={totalPendingChanges === 0}>
            <span className="dg-item-label"><ArrowUp size={13} /> Submit All Changes</span>
            <span className="dg-item-shortcut">⌘⏎</span>
          </button>
          <button className="dg-menu-item" onClick={handleCopyAsInsert}>
            <span className="dg-item-label"><Copy size={13} /> Copy as INSERT</span>
          </button>
          <button className="dg-menu-item" onClick={handleCopyAsUpdate}>
            <span className="dg-item-label"><Copy size={13} /> Copy as UPDATE</span>
          </button>
        </div>
      )}

      {/* DML Preview Modal */}
      {showDmlModal && (
        <div className="modal-backdrop">
          <div className="modal-container dml-preview-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code2 size={16} color="#1677ff" />
                <h3>Pending DML Mutations Preview</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDmlModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                The following SQL statements will be submitted to <strong>{tableName}</strong> in a transaction:
              </p>
              <pre className="dml-code-box">
                {generateDmlStatements().length > 0 
                  ? generateDmlStatements().join('\n') 
                  : '-- No pending changes staged.'}
              </pre>
            </div>
            <div className="modal-footer-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn secondary"
                onClick={() => {
                  navigator.clipboard.writeText(generateDmlStatements().join('\n'));
                  setCopyFeedback('DML Script copied to clipboard!');
                  setTimeout(() => setCopyFeedback(null), 2500);
                }}
              >
                <CopyCheck size={13} /> Copy SQL
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn secondary" onClick={() => setShowDmlModal(false)}>
                  Close
                </button>
                <button 
                  className="btn primary"
                  onClick={handleSubmitAllChanges}
                  disabled={isSubmittingAll || generateDmlStatements().length === 0}
                >
                  <Check size={14} /> Submit Changes ({totalPendingChanges})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show / Hide Columns Modal */}
      {showColModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Choose Columns to Display</h3>
              <button className="modal-close-btn" onClick={() => setShowColModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '340px' }}>
              <div className="col-checkboxes-list">
                {data?.columns?.map(col => {
                  const isChecked = !hiddenCols.includes(col);
                  return (
                    <label key={col} className="col-chk-row">
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setHiddenCols(prev => [...prev, col]);
                          } else {
                            setHiddenCols(prev => prev.filter(c => c !== col));
                          }
                        }}
                      />
                      <span>{col}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer-row">
              <button className="btn secondary" onClick={() => setHiddenCols([])}>
                Show All
              </button>
              <button className="btn primary" onClick={() => setShowColModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DateTime Picker Popover */}
      {activePicker && (
        <DateTimePicker
          value={
            activePicker.target === 'staged'
              ? stagedInserts.find(r => r.tempId === activePicker.rowKey)?.values[activePicker.colName] ?? ''
              : editValue
          }
          colType={schema?.columns?.find(c => c.name === activePicker.colName)?.type || 'datetime'}
          anchorRect={activePicker.anchorRect}
          onChange={(newVal) => {
            if (activePicker.target === 'staged') {
              handleUpdateStagedInsertValue(String(activePicker.rowKey), activePicker.colName, newVal);
              if (missingRequiredCols.has(activePicker.colName) && newVal.trim() !== '') {
                setMissingRequiredCols(prev => {
                  const next = new Set(prev);
                  next.delete(activePicker.colName);
                  return next;
                });
              }
            } else {
              setEditValue(newVal);
            }
          }}
          onClose={() => setActivePicker(null)}
        />
      )}

      {/* Discard Changes Confirmation Modal */}
      {showDiscardChangesModal && (
        <div className="modal-backdrop">
          <div className="grid-confirm-modal">
            <div className="dg-confirm-content">
              <AlertTriangle size={24} className="dg-confirm-icon-warn" />
              <div className="dg-confirm-text">
                <h4>Ignore Unsubmitted Changes</h4>
                <p>Changes are not submitted. Data will be lost. Continue?</p>
              </div>
            </div>
            <div className="dg-confirm-actions">
              <button 
                className="dg-btn-secondary"
                onClick={() => {
                  setShowDiscardChangesModal(false);
                  setPendingActionAfterDiscard(null);
                }}
              >
                No
              </button>
              <button 
                className="dg-btn-primary"
                onClick={() => {
                  setShowDiscardChangesModal(false);
                  handleRevertAll();
                  if (pendingActionAfterDiscard) {
                    pendingActionAfterDiscard();
                    setPendingActionAfterDiscard(null);
                  }
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Header Hover Tooltip (e.g. pt: varchar(255)) */}
      {hoveredColTooltip && (
        <div 
          className="grid-header-tooltip"
          style={{ left: hoveredColTooltip.x, top: hoveredColTooltip.y }}
        >
          {hoveredColTooltip.colName}: {hoveredColTooltip.colType.toLowerCase()}
        </div>
      )}

      {/* Column Quick Filter Popover (From Funnel Y icon on column) */}
      {colFilterPopover && (
        <div 
          className="grid-col-filter-popover"
          style={{ left: colFilterPopover.x, top: colFilterPopover.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="filter-popover-title">
            Filter by <strong>{colFilterPopover.colName}</strong>
          </div>
          <div className="filter-popover-controls">
            <select 
              className="filter-op-select"
              value={colFilterOp}
              onChange={e => setColFilterOp(e.target.value)}
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
              <option value="LIKE">LIKE (%..%)</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="IS NULL">IS NULL</option>
              <option value="IS NOT NULL">IS NOT NULL</option>
            </select>
            {!['IS NULL', 'IS NOT NULL'].includes(colFilterOp) && (
              <input 
                autoFocus
                type="text" 
                className="filter-val-input"
                value={colFilterVal}
                onChange={e => setColFilterVal(e.target.value)}
                placeholder="Filter value..."
                onKeyDown={e => { if (e.key === 'Enter') handleApplyColFilter(); }}
              />
            )}
          </div>
          <div className="filter-popover-actions">
            <button className="dg-btn-secondary" onClick={handleClearColFilter}>
              Clear
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="dg-btn-secondary" onClick={() => setColFilterPopover(null)}>
                Cancel
              </button>
              <button className="dg-btn-primary" onClick={handleApplyColFilter}>
                Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table DDL Script Modal */}
      {showDdlModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code2 size={16} color="#3574f0" />
                <h3>Table DDL: {tableName}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDdlModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '12px', color: '#8c919b', marginBottom: '8px' }}>
                Definition script (CREATE TABLE) for <strong>{tableName}</strong>:
              </p>
              <pre className="dml-code-box" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {generateTableDdl()}
              </pre>
            </div>
            <div className="modal-footer-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn secondary"
                onClick={() => {
                  navigator.clipboard.writeText(generateTableDdl());
                  setCopyFeedback('DDL copied to clipboard');
                  setTimeout(() => setCopyFeedback(null), 2500);
                }}
              >
                <CopyCheck size={13} /> Copy DDL
              </button>
              <button className="btn primary" onClick={() => setShowDdlModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Visualization / Quick Charts Modal */}
      {showChartModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} color="#3574f0" />
                <h3>Data Visualizer (Charts) - {tableName}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowChartModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {renderQuickChart()}
            </div>
            <div className="modal-footer-row" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={() => setShowChartModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Structure / Schema Columns Modal */}
      {showCompareModal && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitCompare size={16} color="#3574f0" />
                <h3>Structure & Column Definitions: {tableName}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowCompareModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '360px', overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', width: '40px' }}>#</th>
                    <th style={{ padding: '6px 10px' }}>Column</th>
                    <th style={{ padding: '6px 10px' }}>Data Type</th>
                    <th style={{ padding: '6px 10px' }}>Nullable</th>
                    <th style={{ padding: '6px 10px' }}>Key / Default</th>
                  </tr>
                </thead>
                <tbody>
                  {schema?.columns?.map((c, i) => (
                    <tr key={c.name} className="data-row">
                      <td style={{ padding: '6px 10px', color: '#8c919b', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', fontWeight: c.primaryKey ? 600 : 400, color: c.primaryKey ? '#61afef' : '#e6e6e6' }}>
                        {c.name} {c.primaryKey && '🔑'}
                      </td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{c.type}</td>
                      <td style={{ padding: '6px 10px', color: c.notNull ? '#f47067' : '#7ee787' }}>
                        {c.notNull ? 'NO' : 'YES'}
                      </td>
                      <td style={{ padding: '6px 10px', color: '#8c919b', fontFamily: 'var(--font-mono)' }}>
                        {c.defaultValue || (c.autoIncrement ? 'AUTO_INCREMENT' : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer-row" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={() => setShowCompareModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
