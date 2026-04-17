/**
 * DataLabel.jsx — Monospace numeric data display
 * Uses Fira Code for tabular-nums alignment (prevents UI jitter from changing digits)
 */

import React from 'react';

export default function DataLabel({
  label,
  value,
  unit = '',
  color = '#00E5FF',
  size = 'normal', // 'normal' | 'large' | 'small'
  className = '',
}) {
  const sizeStyles = {
    small: { fontSize: '0.75rem', valueSize: '0.875rem' },
    normal: { fontSize: '0.75rem', valueSize: '1.125rem' },
    large: { fontSize: '0.875rem', valueSize: '2rem' },
  };

  const s = sizeStyles[size] || sizeStyles.normal;

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {label && (
        <span
          style={{
            fontSize: s.fontSize,
            color: '#9CA3AF',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
      )}
      <span
        className="font-mono-data"
        style={{
          fontSize: s.valueSize,
          color,
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: '0.7em', color: '#9CA3AF', marginLeft: '4px', fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
