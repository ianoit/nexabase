import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  AreaChart as AreaIcon, 
  Sparkles, 
  TrendingUp, 
  Filter
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';
import type { TableSchema, QueryResult } from '../types/database';

interface ChartsVisualizerProps {
  connectionId: string;
  schemas: TableSchema[];
}

export const ChartsVisualizer: React.FC<ChartsVisualizerProps> = ({
  connectionId,
  schemas,
}) => {
  const [selectedTable, setSelectedTable] = useState<string>('products');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');
  const [xCol, setXCol] = useState<string>('title');
  const [yCol, setYCol] = useState<string>('price');
  const [data, setData] = useState<QueryResult | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (schemas.length > 0 && !schemas.some(s => s.name === selectedTable)) {
      setSelectedTable(schemas[0].name);
    }
  }, [schemas]);

  useEffect(() => {
    try {
      const res = dbEngine.getTableData(connectionId, selectedTable, 0, 50);
      setData(res);

      const schema = schemas.find(s => s.name === selectedTable);
      if (schema) {
        // pick first text col for X and first numeric col for Y
        const textCol = schema.columns.find(c => c.type.includes('CHAR') || c.type.includes('TEXT'))?.name || schema.columns[0]?.name;
        const numCol = schema.columns.find(c => c.type.includes('INT') || c.type.includes('REAL') || c.type.includes('FLOAT') || c.type.includes('NUM'))?.name || schema.columns[1]?.name;
        if (textCol) setXCol(textCol);
        if (numCol) setYCol(numCol);
      }
    } catch (err) {
      console.error('Failed to load chart data:', err);
    }
  }, [connectionId, selectedTable]);

  const xIdx = data?.columns?.indexOf(xCol) ?? -1;
  const yIdx = data?.columns?.indexOf(yCol) ?? -1;

  const chartData = (data?.values || []).map(row => ({
    label: String(row[xIdx] ?? 'N/A'),
    value: Number(row[yIdx]) || 0,
  })).filter(d => !isNaN(d.value)).slice(0, 15);

  const totalVal = chartData.reduce((acc, d) => acc + d.value, 0);
  const avgVal = chartData.length > 0 ? totalVal / chartData.length : 0;
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1;
  const minVal = chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) : 0;

  const currentSchema = schemas.find(s => s.name === selectedTable);

  return (
    <div className="charts-visualizer-container">
      {/* Control Header */}
      <div className="charts-controls-bar">
        <div className="chart-ctrl-group">
          <label><Filter size={13} /> Source Table</label>
          <select 
            value={selectedTable} 
            onChange={e => setSelectedTable(e.target.value)}
            className="ctrl-select"
          >
            {schemas.map(s => (
              <option key={s.name} value={s.name}>{s.name} ({s.rowCount ?? 0} rows)</option>
            ))}
          </select>
        </div>

        <div className="chart-ctrl-group">
          <label>X-Axis (Dimension)</label>
          <select 
            value={xCol} 
            onChange={e => setXCol(e.target.value)}
            className="ctrl-select"
          >
            {currentSchema?.columns?.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="chart-ctrl-group">
          <label>Y-Axis (Metric)</label>
          <select 
            value={yCol} 
            onChange={e => setYCol(e.target.value)}
            className="ctrl-select"
          >
            {currentSchema?.columns?.map(c => (
              <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
            ))}
          </select>
        </div>

        <div className="chart-type-pills">
          <button 
            className={`type-pill ${chartType === 'bar' ? 'active' : ''}`}
            onClick={() => setChartType('bar')}
            title="Vertical Bar Chart"
          >
            <BarChart3 size={14} />
            <span>Bar</span>
          </button>
          <button 
            className={`type-pill ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
            title="Line Trend Chart"
          >
            <LineChart size={14} />
            <span>Line</span>
          </button>
          <button 
            className={`type-pill ${chartType === 'area' ? 'active' : ''}`}
            onClick={() => setChartType('area')}
            title="Filled Area Chart"
          >
            <AreaIcon size={14} />
            <span>Area</span>
          </button>
          <button 
            className={`type-pill ${chartType === 'pie' ? 'active' : ''}`}
            onClick={() => setChartType('pie')}
            title="Donut / Pie Chart"
          >
            <PieChart size={14} />
            <span>Pie</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Metric Cards */}
      <div className="analytics-kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">TOTAL {yCol.toUpperCase()}</div>
          <div className="kpi-value">{totalVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          <div className="kpi-sub">Sum of {chartData.length} data points</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">AVERAGE</div>
          <div className="kpi-value">{avgVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          <div className="kpi-sub">Per item benchmark</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">MAX VALUE</div>
          <div className="kpi-value text-emerald">{maxVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          <div className="kpi-sub">Peak value observed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">MIN VALUE</div>
          <div className="kpi-value text-indigo">{minVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          <div className="kpi-sub">Baseline minimum</div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="chart-canvas-card">
        <div className="chart-card-header">
          <div className="chart-header-title">
            <TrendingUp size={16} className="trend-icon" />
            <h4>{yCol.toUpperCase()} by {xCol.toUpperCase()}</h4>
          </div>
          <span className="chart-engine-badge">Nexabase Visual Engine</span>
        </div>

        <div className="svg-chart-container">
          {chartData.length === 0 ? (
            <div className="empty-chart-prompt">
              <Sparkles size={32} />
              <p>No numeric data found to visualize. Choose another column.</p>
            </div>
          ) : chartType === 'bar' ? (
            <div className="bar-chart-viewport">
              <div className="bars-flex-container">
                {chartData.map((d, idx) => {
                  const heightPercent = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
                  const isHovered = hoveredIndex === idx;

                  return (
                    <div 
                      key={idx} 
                      className="bar-item-wrapper"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="bar-tooltip">
                          <strong>{d.label}</strong>
                          <span>{d.value.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="bar-track">
                        <div 
                          className={`bar-fill ${isHovered ? 'hovered' : ''}`}
                          style={{ height: `${Math.max(4, heightPercent)}%` }}
                        ></div>
                      </div>
                      <span className="bar-label" title={d.label}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : chartType === 'line' || chartType === 'area' ? (
            <svg viewBox="0 0 800 320" className="line-chart-svg">
              <defs>
                <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                <line 
                  key={i} 
                  x1="60" 
                  y1={30 + pct * 240} 
                  x2="780" 
                  y2={30 + pct * 240} 
                  stroke="rgba(255,255,255,0.06)" 
                />
              ))}

              {/* Area & Line */}
              {(() => {
                const points = chartData.map((d, i) => {
                  const x = 70 + (i / Math.max(1, chartData.length - 1)) * 700;
                  const y = 270 - (maxVal > 0 ? (d.value / maxVal) * 230 : 0);
                  return { x, y, ...d };
                });

                const pathLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const pathArea = `${pathLine} L ${points[points.length - 1].x} 270 L ${points[0].x} 270 Z`;

                return (
                  <>
                    {chartType === 'area' && (
                      <path d={pathArea} fill="url(#area-grad)" />
                    )}
                    <path d={pathLine} fill="none" stroke="#38bdf8" strokeWidth="3" />
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="5" fill="#0284c7" stroke="#fff" strokeWidth="2" />
                        <text x={p.x} y="295" textAnchor="middle" fill="#94a3b8" fontSize="10">
                          {p.label.length > 10 ? p.label.slice(0, 9) + '…' : p.label}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          ) : (
            // Pie / Donut Chart
            <div className="donut-chart-view">
              <svg viewBox="0 0 300 300" className="donut-svg">
                {(() => {
                  let accumulatedAngle = 0;
                  const colors = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#fb923c'];

                  return chartData.slice(0, 7).map((d, i) => {
                    const sliceAngle = totalVal > 0 ? (d.value / totalVal) * 360 : 0;
                    const startAngle = accumulatedAngle;
                    accumulatedAngle += sliceAngle;

                    const r = 100;
                    const cx = 150;
                    const cy = 150;

                    const x1 = cx + r * Math.cos((Math.PI * (startAngle - 90)) / 180);
                    const y1 = cy + r * Math.sin((Math.PI * (startAngle - 90)) / 180);
                    const x2 = cx + r * Math.cos((Math.PI * (accumulatedAngle - 90)) / 180);
                    const y2 = cy + r * Math.sin((Math.PI * (accumulatedAngle - 90)) / 180);

                    const largeArc = sliceAngle > 180 ? 1 : 0;
                    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                    return (
                      <path
                        key={i}
                        d={pathData}
                        fill={colors[i % colors.length]}
                        stroke="#0f172a"
                        strokeWidth="2"
                        className="donut-slice"
                      />
                    );
                  });
                })()}
                <circle cx="150" cy="150" r="50" fill="#0f172a" />
              </svg>
              <div className="donut-legend">
                {chartData.slice(0, 7).map((d, i) => {
                  const colors = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#fb923c'];
                  const pct = totalVal > 0 ? ((d.value / totalVal) * 100).toFixed(1) : '0';
                  return (
                    <div key={i} className="legend-row">
                      <span className="legend-dot" style={{ backgroundColor: colors[i % colors.length] }}></span>
                      <span className="legend-name">{d.label}</span>
                      <span className="legend-pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
