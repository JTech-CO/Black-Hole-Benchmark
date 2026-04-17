import React, { useEffect, useRef, useCallback } from 'react';
import useBenchmarkStore from './store/useBenchmarkStore';
import { BenchmarkLoop } from './engine/BenchmarkLoop';
import OverlayContainer from './components/layout/OverlayContainer';
import HUD from './components/features/HUD';
import ResultModal from './components/features/ResultModal';
import CommandButton from './components/ui/CommandButton';
import GlassPanel from './components/ui/GlassPanel';

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const phase = useBenchmarkStore((s) => s.phase);
  const error = useBenchmarkStore((s) => s.error);
  const progress = useBenchmarkStore((s) => s.progress);
  const currentLevelName = useBenchmarkStore((s) => s.currentLevelName);

  // Initialize WebGL engine on mount
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new BenchmarkLoop(canvasRef.current, useBenchmarkStore);
    engineRef.current = engine;

    const success = engine.init();
    if (!success) {
      console.error('[BHB] Engine initialization failed');
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startBenchmark();
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.stopBenchmark();
  }, []);

  return (
    <>
      {/* WebGL Rendering Canvas — z-index: 0 */}
      <canvas
        ref={canvasRef}
        id="bhb-canvas"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          display: 'block',
          zIndex: 0,
          background: '#000',
          cursor: 'grab',
        }}
      />

      {/* UI Overlay — z-index: 10 */}
      <OverlayContainer>
        {/* Top-left: Brand */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            pointerEvents: 'auto',
          }}
        >
          <h1
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#F3F4F6',
            }}
          >
            Black Hole
            <span style={{ color: '#38BDF8', marginLeft: '6px' }} className="text-glow-cyan">
              Benchmark
            </span>
          </h1>
          <p style={{
            fontSize: '0.6rem',
            color: '#9CA3AF',
            marginTop: '2px',
            letterSpacing: '0.1em',
          }}>
          </p>

          {/* Progress UI Modal (Top-Left under Title) */}
          {phase === 'running' && (
            <GlassPanel
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                minWidth: '200px',
                borderLeft: '4px solid #38BDF8',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Progress Status
                </span>
                <span className="font-mono-data" style={{ fontSize: '0.75rem', color: '#E2E8F0', fontWeight: 600 }}>
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.65rem', color: '#38BDF8' }} className="font-mono-data">
                {currentLevelName}
              </div>
            </GlassPanel>
          )}
        </div>

        {/* HUD — Top Right */}
        <HUD />

        {/* Controls — Bottom Center */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            pointerEvents: 'auto',
          }}
        >
          {phase === 'idle' && (
            <div className="animate-fade-in-up" style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: '0.7rem',
                color: '#9CA3AF',
                marginBottom: '16px',
                letterSpacing: '0.05em',
              }}>
                Drag to explore • Click below to begin
              </p>
              <CommandButton id="btn-start-benchmark" onClick={handleStart}>
                Start Benchmark
              </CommandButton>
            </div>
          )}

          {phase === 'running' && (
            <div className="animate-fade-in-up" style={{ textAlign: 'center' }}>
              <CommandButton
                id="btn-stop-benchmark"
                variant="danger"
                size="small"
                onClick={handleStop}
              >
                Abort
              </CommandButton>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
          >
            <GlassPanel strong style={{ padding: '30px 36px', textAlign: 'center', maxWidth: '400px' }}>
              <div style={{
                fontSize: '2rem',
                marginBottom: '12px',
              }}>
                ⚠️
              </div>
              <p style={{
                fontSize: '0.9rem',
                color: '#FF2A6D',
                fontWeight: 600,
                marginBottom: '8px',
              }}>
                GPU 한계 도달
              </p>
              <p style={{
                fontSize: '0.8rem',
                color: '#9CA3AF',
                lineHeight: 1.5,
              }}>
                {error}
              </p>
            </GlassPanel>
          </div>
        )}

        {/* Result Modal */}
        <ResultModal />
      </OverlayContainer>
    </>
  );
}
