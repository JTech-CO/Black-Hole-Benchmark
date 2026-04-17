/**
 * CommandButton.jsx — Solid, analytical button 
 * pointer-events: auto is applied to ensure clicks work inside the overlay
 */

import React from 'react';

export default function CommandButton({
  children,
  onClick,
  variant = 'default', // 'default' | 'danger' | 'filled'
  size = 'normal',      // 'normal' | 'small'
  disabled = false,
  className = '',
  id,
  ...props
}) {
  const variantClass = variant === 'danger' ? 'neon-btn--danger' 
                     : variant === 'filled' ? 'neon-btn--filled' 
                     : '';
  const sizeClass = size === 'small' ? 'neon-btn--small' : '';

  return (
    <button
      id={id}
      className={`neon-btn ${variantClass} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{ pointerEvents: 'auto', opacity: disabled ? 0.4 : 1 }}
      {...props}
    >
      {children}
    </button>
  );
}
