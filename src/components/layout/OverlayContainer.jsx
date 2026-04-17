/**
 * OverlayContainer.jsx — Top-level overlay wrapper
 * 
 * Applies pointer-events: none to the entire overlay so mouse events
 * pass through to the WebGL canvas below. Interactive child elements
 * (buttons, etc.) must set pointer-events: auto individually.
 */

import React from 'react';

export default function OverlayContainer({ children }) {
  return (
    <div
      id="overlay-container"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}
