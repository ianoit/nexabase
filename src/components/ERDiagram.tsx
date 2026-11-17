import React, { useState, useRef, useEffect } from 'react';
import { 
  Key, 
  Link2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Layout, 
  Download, 
  Database,
  ExternalLink
} from 'lucide-react';
import type { TableSchema } from '../types/database';

interface ERDiagramProps {
  schemas: TableSchema[];
  onOpenTable: (tableName: string) => void;
  onDesignTable: (tableName: string) => void;
}

interface TablePosition {
  x: number;
  y: number;
}

export const ERDiagram: React.FC<ERDiagramProps> = ({
  schemas,
  onOpenTable,
  onDesignTable,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<Record<string, TablePosition>>({});
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Auto layout positioning
  const autoArrange = () => {
    const newPositions: Record<string, TablePosition> = {};
    const cols = Math.ceil(Math.sqrt(schemas.length));
    const cardWidth = 280;
    const cardHeight = 320;
    const gapX = 80;
    const gapY = 80;

    schemas.forEach((schema, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      newPositions[schema.name] = {
        x: 60 + col * (cardWidth + gapX),
        y: 60 + row * (cardHeight + gapY),
      };
    });
    setPositions(newPositions);
  };

  useEffect(() => {
    autoArrange();
  }, [schemas.length]);

  const handleMouseDown = (tableName: string, e: React.MouseEvent) => {
    setDraggingTable(tableName);
    const pos = positions[tableName] || { x: 0, y: 0 };
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingTable) return;
    setPositions(prev => ({
      ...prev,
      [draggingTable]: {
        x: Math.max(20, e.clientX - dragOffset.x),
        y: Math.max(20, e.clientY - dragOffset.y),
      },
    }));
  };

  const handleMouseUp = () => {
    setDraggingTable(null);
  };

  // Collect relationship lines
  interface RelationLine {
    fromTable: string;
    fromCol: string;
    toTable: string;
    toCol: string;
  }

  const relations: RelationLine[] = [];
  schemas.forEach(schema => {
    (schema.foreignKeys || []).forEach(fk => {
      relations.push({
        fromTable: schema.name,
        fromCol: fk.from,
        toTable: fk.table,
        toCol: fk.to,
      });
    });
  });

  const getColYOffset = (schema: TableSchema, colName: string) => {
    const headerHeight = 44;
    const rowHeight = 28;
    const colIdx = schema.columns.findIndex(c => c.name === colName);
    return headerHeight + (colIdx >= 0 ? colIdx : 0) * rowHeight + 14;
  };

  const CARD_WIDTH = 270;

  const exportSvg = () => {
    const svgEl = document.getElementById('er-diagram-svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `er_diagram_model.svg`;
    a.click();
  };

  return (
    <div 
      className="er-diagram-container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Canvas Floating Toolbar */}
      <div className="diagram-floating-bar">
        <div className="diagram-title-group">
          <Database size={15} />
          <span>Entity Relationship Model (libdbdiagram)</span>
          <span className="diagram-table-count">{schemas.length} tables</span>
        </div>

        <div className="bar-actions">
          <button 
            className="diagram-btn" 
            onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button 
            className="diagram-btn" 
            onClick={() => setZoom(z => Math.max(0.4, z - 0.15))}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button 
            className="diagram-btn" 
            onClick={() => setZoom(1)}
            title="Reset Zoom"
          >
            <Maximize2 size={14} />
          </button>

          <div className="bar-sep"></div>

          <button 
            className="diagram-btn primary" 
            onClick={autoArrange}
            title="Auto-Arrange Layout (libogdf)"
          >
            <Layout size={14} />
            <span>Auto Layout</span>
          </button>

          <button 
            className="diagram-btn" 
            onClick={exportSvg}
            title="Export ER Diagram as SVG"
          >
            <Download size={14} />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas for Connectors */}
      <div 
        className="diagram-canvas-viewport"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <svg id="er-diagram-svg" className="diagram-connections-svg">
          <defs>
            <marker
              id="dot-marker"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
            >
              <circle cx="5" cy="5" r="4" fill="#38bdf8" />
            </marker>
            <marker
              id="arrow-marker"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#818cf8" />
            </marker>
          </defs>

          {relations.map((rel, idx) => {
            const fromPos = positions[rel.fromTable];
            const toPos = positions[rel.toTable];
            const fromSchema = schemas.find(s => s.name === rel.fromTable);
            const toSchema = schemas.find(s => s.name === rel.toTable);

            if (!fromPos || !toPos || !fromSchema || !toSchema) return null;

            const fromY = fromPos.y + getColYOffset(fromSchema, rel.fromCol);
            const toY = toPos.y + getColYOffset(toSchema, rel.toCol);

            // Connect nearest edges
            const fromRight = fromPos.x + CARD_WIDTH;
            const toRight = toPos.x + CARD_WIDTH;

            let startX = fromRight;
            let endX = toPos.x;

            if (fromPos.x > toPos.x) {
              startX = fromPos.x;
              endX = toRight;
            }

            const dx = Math.abs(endX - startX) * 0.5;
            const pathData = `M ${startX} ${fromY} C ${startX + (startX < endX ? dx : -dx)} ${fromY}, ${endX - (startX < endX ? dx : -dx)} ${toY}, ${endX} ${toY}`;

            return (
              <g key={idx} className="relation-path-group">
                <path
                  d={pathData}
                  className="relation-path"
                  markerStart="url(#dot-marker)"
                  markerEnd="url(#arrow-marker)"
                />
                <text
                  x={(startX + endX) / 2}
                  y={(fromY + toY) / 2 - 8}
                  className="relation-label"
                  textAnchor="middle"
                >
                  {rel.fromCol} → {rel.toTable}.{rel.toCol}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Table Cards */}
        {schemas.map(schema => {
          const pos = positions[schema.name] || { x: 50, y: 50 };
          const isDragging = draggingTable === schema.name;

          return (
            <div
              key={schema.name}
              className={`table-node-card ${isDragging ? 'dragging' : ''}`}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${CARD_WIDTH}px`,
              }}
            >
              {/* Card Header */}
              <div 
                className="table-node-header"
                onMouseDown={(e) => handleMouseDown(schema.name, e)}
              >
                <div className="node-title-group">
                  <span className="node-title">{schema.name}</span>
                  <span className="node-rows-pill">{schema.rowCount ?? 0} rows</span>
                </div>
                <div className="node-actions">
                  <button 
                    className="node-link-btn" 
                    onClick={() => onOpenTable(schema.name)}
                    title="Open Table Data"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Column Rows */}
              <div className="table-node-columns">
                {schema.columns.map(col => {
                  const isFk = (schema.foreignKeys || []).some(fk => fk.from === col.name);
                  const isPk = col.primaryKey || (col as any).isPk;
                  const colType = col.type || (col as any).dataType || 'TEXT';

                  return (
                    <div key={col.name} className="node-col-row">
                      <div className="col-icon-wrapper">
                        {isPk ? (
                          <span title="Primary Key"><Key size={12} className="col-pk-icon" /></span>
                        ) : isFk ? (
                          <span title="Foreign Key"><Link2 size={12} className="col-fk-icon" /></span>
                        ) : (
                          <span className="col-bullet">•</span>
                        )}
                      </div>
                      <span className={`col-name-text ${isPk ? 'is-pk' : ''}`}>
                        {col.name}
                      </span>
                      <span className="col-type-badge">{colType}</span>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer */}
              <div className="table-node-footer">
                <button 
                  className="footer-btn" 
                  onClick={() => onDesignTable(schema.name)}
                >
                  Design Schema
                </button>
                <button 
                  className="footer-btn" 
                  onClick={() => onOpenTable(schema.name)}
                >
                  View Data
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
