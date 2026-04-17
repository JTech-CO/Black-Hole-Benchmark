/**
 * GlassPanel.jsx — Glassmorphism container with backdrop blur
 * Used as a base for HUD, modals, and other overlay panels
 */

import React from 'react';

export default function GlassPanel({ children, className = '', strong = false, style = {}, ...props }) {
  return (
    <div
      className={`${strong ? 'glass-panel-strong' : 'glass-panel'} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
