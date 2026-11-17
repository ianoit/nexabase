import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  Database, 
  Loader2 
} from 'lucide-react';
import { dbEngine } from '../services/dbEngine';
import type { TableSchema } from '../types/database';

interface DataGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  schemas: TableSchema[];
  onDataGenerated: () => void;
}

const FIRST_NAMES = ['Bambang', 'Siti', 'Aditya', 'Dewi', 'Rian', 'Kartika', 'Andi', 'Rina', 'Bayu', 'Mega', 'Eko', 'Fitri'];
const LAST_NAMES = ['Wijaya', 'Kusuma', 'Santoso', 'Pratama', 'Hidayat', 'Saputra', 'Suryono', 'Utami', 'Lestari', 'Siregar'];
const CITIES = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Yogyakarta', 'Denpasar', 'Makassar', 'Palembang', 'Malang'];
const PRODUCTS_TITLES = ['Mechanical Keyboard', 'Studio Monitor', 'Wireless Earbuds', 'Ergonomic Desk', 'USB-C Dock', '4K Webcam', 'Smart Lamp', 'Noise-Cancelling Mic'];

export const DataGeneratorModal: React.FC<DataGeneratorModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  schemas,
  onDataGenerated,
}) => {
  const [selectedTable, setSelectedTable] = useState<string>(schemas[0]?.name || 'customers');
  const [rowCount, setRowCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSchema = schemas.find(s => s.name === selectedTable);

  const generateValForCol = (colName: string, colType: string, rowIdx: number) => {
    const lowerName = colName.toLowerCase();
    const rand = Math.floor(Math.random() * 1000);

    if (lowerName.includes('first_name')) {
      return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    }
    if (lowerName.includes('last_name')) {
      return LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    }
    if (lowerName.includes('name') || lowerName.includes('title')) {
      return `${PRODUCTS_TITLES[Math.floor(Math.random() * PRODUCTS_TITLES.length)]} Gen-${rand}`;
    }
    if (lowerName.includes('email')) {
      const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)].toLowerCase();
      const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)].toLowerCase();
      return `${fn}.${ln}${rand}@example.com`;
    }
    if (lowerName.includes('phone')) {
      return `+62 812-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (lowerName.includes('city')) {
      return CITIES[Math.floor(Math.random() * CITIES.length)];
    }
    if (lowerName.includes('price') || lowerName.includes('amount') || lowerName.includes('subtotal')) {
      return Math.round((Math.random() * 450 + 19.99) * 100) / 100;
    }
    if (lowerName.includes('stock') || lowerName.includes('quantity')) {
      return Math.floor(Math.random() * 80) + 5;
    }
    if (lowerName.includes('rating')) {
      return Math.round((3.5 + Math.random() * 1.5) * 10) / 10;
    }
    if (lowerName.includes('sku') || lowerName.includes('code') || lowerName.includes('slug')) {
      return `SKU-MOCK-${rand}-${rowIdx}`;
    }
    if (lowerName.includes('status')) {
      const statuses = ['Active', 'Completed', 'Processing', 'Delivered', 'Pending'];
      return statuses[Math.floor(Math.random() * statuses.length)];
    }
    if (lowerName.includes('date') || lowerName.includes('time')) {
      return new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().replace('T', ' ').slice(0, 19);
    }
    if (colType.includes('INT')) {
      return Math.floor(Math.random() * 100) + 1;
    }
    if (colType.includes('REAL') || colType.includes('FLOAT') || colType.includes('NUM')) {
      return Math.round((Math.random() * 200) * 100) / 100;
    }
    return `Sample Data ${rand}`;
  };

  const handleGenerate = () => {
    if (!currentSchema) return;
    setIsGenerating(true);
    setSuccessMsg(null);

    setTimeout(() => {
      try {
        const insertCols = currentSchema.columns.filter(c => !(c.primaryKey && c.autoIncrement));

        for (let i = 0; i < rowCount; i++) {
          const rowData: Record<string, any> = {};
          insertCols.forEach(col => {
            rowData[col.name] = generateValForCol(col.name, col.type, i + 1);
          });
          dbEngine.insertRow(connectionId, selectedTable, rowData);
        }

        setIsGenerating(false);
        setSuccessMsg(`Successfully generated and inserted ${rowCount} mock records into "${selectedTable}"!`);
        onDataGenerated();
      } catch (err: any) {
        setIsGenerating(false);
        alert(`Generation failed: ${err.message}`);
      }
    }, 400);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container data-generator-modal">
        <div className="modal-header">
          <div className="modal-title-row">
            <Sparkles className="modal-icon text-amber" />
            <h3>Data Generator</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-subtitle">
            Generate realistic synthetic test data automatically mapped to your table column names and data types.
          </p>

          <div className="form-row">
            <div className="form-field flex-2">
              <label><Database size={13} /> Target Table</label>
              <select 
                value={selectedTable} 
                onChange={e => setSelectedTable(e.target.value)}
                className="modal-select"
              >
                {schemas.map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.columns.length} columns)</option>
                ))}
              </select>
            </div>

            <div className="form-field flex-1">
              <label>Number of Rows</label>
              <select 
                value={rowCount} 
                onChange={e => setRowCount(Number(e.target.value))}
                className="modal-select"
              >
                <option value={5}>5 Rows</option>
                <option value={10}>10 Rows</option>
                <option value={25}>25 Rows</option>
                <option value={50}>50 Rows</option>
                <option value={100}>100 Rows</option>
              </select>
            </div>
          </div>

          {/* Column mappings preview */}
          <div className="generator-cols-box">
            <label className="section-label">DETECTED COLUMN GENERATORS</label>
            <div className="gen-cols-list">
              {currentSchema?.columns?.map(c => (
                <div key={c.name} className="gen-col-item">
                  <span className="gen-col-name">{c.name}</span>
                  <span className="gen-col-type">{c.type}</span>
                  <span className="gen-col-rule">
                    {c.primaryKey && c.autoIncrement ? 'Auto Incremented' : 'Synthetic Smart Fill'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {successMsg && (
            <div className="connection-feedback success">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        <div className="modal-footer-row">
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
          <button 
            type="button" 
            className="btn primary" 
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={14} className="spin-icon" /> : <Sparkles size={14} />}
            <span>{isGenerating ? 'Generating...' : `Generate ${rowCount} Records`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
