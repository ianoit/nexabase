import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Clock, Check, Ban } from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  colType?: string;
  anchorRect: DOMRect | null;
  onChange: (newVal: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const isDateColumn = (type?: string): boolean => {
  if (!type) return false;
  const t = type.toLowerCase();
  return t === 'date';
};

export const isDateTimeColumn = (type?: string): boolean => {
  if (!type) return false;
  const t = type.toLowerCase();
  return t.includes('datetime') || t.includes('timestamp');
};

export const isTimeColumn = (type?: string): boolean => {
  if (!type) return false;
  const t = type.toLowerCase();
  return t.includes('time') && !t.includes('timestamp') && !t.includes('datetime');
};

export const isTemporalColumn = (type?: string): boolean => {
  return isDateColumn(type) || isDateTimeColumn(type) || isTimeColumn(type);
};

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  colType = 'datetime',
  anchorRect,
  onChange,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  // Parse initial parts
  const parseParts = (val: string) => {
    if (!val || val === '<null>' || val.toUpperCase() === 'NULL' || val.trim() === '') {
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
      };
    }

    const match = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: Math.max(0, Math.min(11, parseInt(match[2], 10) - 1)),
        day: Math.max(1, Math.min(31, parseInt(match[3], 10))),
        hours: match[4] !== undefined ? Math.max(0, Math.min(23, parseInt(match[4], 10))) : now.getHours(),
        minutes: match[5] !== undefined ? Math.max(0, Math.min(59, parseInt(match[5], 10))) : now.getMinutes(),
        seconds: match[6] !== undefined ? Math.max(0, Math.min(59, parseInt(match[6], 10))) : 0,
      };
    }

    // Try time only (HH:mm:ss)
    const timeMatch = val.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (timeMatch) {
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
        hours: Math.max(0, Math.min(23, parseInt(timeMatch[1], 10))),
        minutes: Math.max(0, Math.min(59, parseInt(timeMatch[2], 10))),
        seconds: timeMatch[3] !== undefined ? Math.max(0, Math.min(59, parseInt(timeMatch[3], 10))) : 0,
      };
    }

    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
        hours: d.getHours(),
        minutes: d.getMinutes(),
        seconds: d.getSeconds(),
      };
    }

    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds(),
    };
  };

  const initial = parseParts(value);
  const [year, setYear] = useState<number>(initial.year);
  const [month, setMonth] = useState<number>(initial.month);
  const [day, setDay] = useState<number>(initial.day);
  const [hours, setHours] = useState<number>(initial.hours);
  const [minutes, setMinutes] = useState<number>(initial.minutes);
  const [seconds, setSeconds] = useState<number>(initial.seconds);

  const isDateOnly = isDateColumn(colType);
  const isTimeOnly = isTimeColumn(colType);

  // Format and propagate updates
  const formatAndEmit = (y: number, m: number, d: number, h: number, min: number, s: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    if (isDateOnly) {
      onChange(`${y}-${pad(m + 1)}-${pad(d)}`);
    } else if (isTimeOnly) {
      onChange(`${pad(h)}:${pad(min)}:${pad(s)}`);
    } else {
      onChange(`${y}-${pad(m + 1)}-${pad(d)} ${pad(h)}:${pad(min)}:${pad(s)}`);
    }
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    const maxDay = new Date(newYear, month + 1, 0).getDate();
    const clampedDay = Math.min(day, maxDay);
    if (clampedDay !== day) setDay(clampedDay);
    formatAndEmit(newYear, month, clampedDay, hours, minutes, seconds);
  };

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth);
    const maxDay = new Date(year, newMonth + 1, 0).getDate();
    const clampedDay = Math.min(day, maxDay);
    if (clampedDay !== day) setDay(clampedDay);
    formatAndEmit(year, newMonth, clampedDay, hours, minutes, seconds);
  };

  const handleDayChange = (newDay: number) => {
    setDay(newDay);
    formatAndEmit(year, month, newDay, hours, minutes, seconds);
  };

  const handleHoursChange = (newH: number) => {
    const clamped = Math.max(0, Math.min(23, newH));
    setHours(clamped);
    formatAndEmit(year, month, day, clamped, minutes, seconds);
  };

  const handleMinutesChange = (newMin: number) => {
    const clamped = Math.max(0, Math.min(59, newMin));
    setMinutes(clamped);
    formatAndEmit(year, month, day, hours, clamped, seconds);
  };

  const handleSecondsChange = (newSec: number) => {
    const clamped = Math.max(0, Math.min(59, newSec));
    setSeconds(clamped);
    formatAndEmit(year, month, day, hours, minutes, clamped);
  };

  const handleSetNow = () => {
    const cur = new Date();
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d = cur.getDate();
    const h = cur.getHours();
    const min = cur.getMinutes();
    const s = cur.getSeconds();

    setYear(y);
    setMonth(m);
    setDay(d);
    setHours(h);
    setMinutes(min);
    setSeconds(s);

    formatAndEmit(y, m, d, h, min, s);
  };

  const handleSetNull = () => {
    onChange('');
    onClose();
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Positioning
  let top = 200;
  let left = 200;
  if (anchorRect) {
    top = anchorRect.bottom + 4;
    left = Math.max(10, Math.min(window.innerWidth - 300, anchorRect.left));
    // If popover overflows viewport height, place above cell
    if (top + 160 > window.innerHeight) {
      top = Math.max(10, anchorRect.top - 165);
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      ref={popoverRef}
      className="dg-datetime-popover"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Row 1: Date Controls (Day, Month, Year) */}
      {!isTimeOnly && (
        <div className="dg-picker-date-row">
          {/* Day dropdown */}
          <div className="dg-control-wrap day-wrap">
            <select
              className="dg-picker-select dg-day-select"
              value={day}
              onChange={e => handleDayChange(Number(e.target.value))}
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Month dropdown */}
          <div className="dg-control-wrap month-wrap">
            <select
              className="dg-picker-select dg-month-select"
              value={month}
              onChange={e => handleMonthChange(Number(e.target.value))}
            >
              {MONTH_NAMES.map((mName, idx) => (
                <option key={mName} value={idx}>
                  {mName}
                </option>
              ))}
            </select>
          </div>

          {/* Year stepper input */}
          <div className="dg-control-wrap year-wrap">
            <input
              type="number"
              className="dg-picker-input dg-year-input"
              value={year}
              onChange={e => handleYearChange(Number(e.target.value))}
            />
            <div className="dg-stepper-btn-group">
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleYearChange(year + 1)}
              >
                <ChevronUp size={10} />
              </button>
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleYearChange(year - 1)}
              >
                <ChevronDown size={10} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Time Controls (HH : MM : SS) */}
      {!isDateOnly && (
        <div className="dg-picker-time-row">
          {/* Hours */}
          <div className="dg-time-cell">
            <input
              type="number"
              min={0}
              max={23}
              className="dg-picker-input dg-time-input"
              value={pad(hours)}
              onChange={e => handleHoursChange(Number(e.target.value))}
            />
            <div className="dg-stepper-btn-group">
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleHoursChange((hours + 1) % 24)}
              >
                <ChevronUp size={10} />
              </button>
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleHoursChange((hours - 1 + 24) % 24)}
              >
                <ChevronDown size={10} />
              </button>
            </div>
          </div>

          <span className="dg-time-separator">:</span>

          {/* Minutes */}
          <div className="dg-time-cell">
            <input
              type="number"
              min={0}
              max={59}
              className="dg-picker-input dg-time-input"
              value={pad(minutes)}
              onChange={e => handleMinutesChange(Number(e.target.value))}
            />
            <div className="dg-stepper-btn-group">
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleMinutesChange((minutes + 1) % 60)}
              >
                <ChevronUp size={10} />
              </button>
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleMinutesChange((minutes - 1 + 60) % 60)}
              >
                <ChevronDown size={10} />
              </button>
            </div>
          </div>

          <span className="dg-time-separator">:</span>

          {/* Seconds */}
          <div className="dg-time-cell">
            <input
              type="number"
              min={0}
              max={59}
              className="dg-picker-input dg-time-input"
              value={pad(seconds)}
              onChange={e => handleSecondsChange(Number(e.target.value))}
            />
            <div className="dg-stepper-btn-group">
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleSecondsChange((seconds + 1) % 60)}
              >
                <ChevronUp size={10} />
              </button>
              <button
                type="button"
                className="dg-stepper-btn"
                onClick={() => handleSecondsChange((seconds - 1 + 60) % 60)}
              >
                <ChevronDown size={10} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Action Buttons (Now, Clear/Null, Close) */}
      <div className="dg-picker-actions-row">
        <button
          type="button"
          className="dg-picker-btn dg-btn-now"
          onClick={handleSetNow}
          title="Set Current Timestamp"
        >
          <Clock size={12} />
          <span>Now</span>
        </button>

        <button
          type="button"
          className="dg-picker-btn dg-btn-null"
          onClick={handleSetNull}
          title="Set value to <null>"
        >
          <Ban size={12} />
          <span>&lt;null&gt;</span>
        </button>

        <button
          type="button"
          className="dg-picker-btn dg-btn-done"
          onClick={onClose}
          title="Done"
        >
          <Check size={12} />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
};

