import React from 'react';
import useBenchmarkStore from '../../store/useBenchmarkStore';
import GlassPanel from '../ui/GlassPanel';
import DataLabel from '../ui/DataLabel';
import { formatNumber } from '../../utils/benchmarkUtils';

export default function HUD() {
  const currentFps = useBenchmarkStore((s) => s.currentFps);
  const currentLevelName = useBenchmarkStore((s) => s.currentLevelName);
  const resolution = useBenchmarkStore((s) => s.resolution);
  const phase = useBenchmarkStore((s) => s.phase);
  const progress = useBenchmarkStore((s) => s.progress);

  // Determine FPS color
  const fpsColor = currentFps >= 55 ? '#10B981' : currentFps >= 30 ? '#F59E0B' : '#E11D48';

  return (
    <GlassPanel
      id="hud-panel"
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        padding: '16px 20px',
        minWidth: '180px',
        pointerEvents: 'auto',
      }}
    >
      {/* Status indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '14px',
        paddingBottom: '10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '0',
            background: phase === 'running' ? '#38BDF8' : phase === 'finished' ? '#10B981' : '#475569',
          }}
          className={phase === 'running' ? 'animate-pulse-glow' : ''}
        />
        <span style={{
          fontSize: '0.7rem',
          color: '#94A3B8',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
          className="font-mono-data"
        >
          {currentLevelName || 'System IDLE'}
        </span>
      </div>

      {/* FPS */}
      <div style={{ marginBottom: '12px' }}>
        <DataLabel
          label="FPS"
          value={formatNumber(currentFps, 1)}
          color={fpsColor}
        />
      </div>

      {/* Resolution */}
      <DataLabel
        label="Resolution"
        value={`${resolution.width}×${resolution.height}`}
        color="#9CA3AF"
        size="small"
      />

      {/* Progress bar */}
      {phase === 'running' && (
        <div style={{ marginTop: '14px' }}>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span style={{
            display: 'block',
            textAlign: 'right',
            fontSize: '0.65rem',
            color: '#9CA3AF',
            marginTop: '4px',
          }}
            className="font-mono-data"
          >
            {Math.round(progress * 100)}%
          </span>
        </div>
      )}
    </GlassPanel>
  );
}
