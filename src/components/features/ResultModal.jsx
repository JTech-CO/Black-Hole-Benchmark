import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import useBenchmarkStore from '../../store/useBenchmarkStore';
import GlassPanel from '../ui/GlassPanel';
import CommandButton from '../ui/CommandButton';
import { formatNumber, getScoreGrade, downsampleForChart, copyResultsToClipboard } from '../../utils/benchmarkUtils';

export default function ResultModal() {
  const phase = useBenchmarkStore((s) => s.phase);
  const result = useBenchmarkStore((s) => s.result);
  const gpuInfo = useBenchmarkStore((s) => s.gpuInfo);
  const reset = useBenchmarkStore((s) => s.reset);
  const [copied, setCopied] = useState(false);

  const isVisible = phase === 'finished' && result;

  const chartData = useMemo(() => {
    if (!result?.frameTimes) return [];
    return downsampleForChart(result.frameTimes, 150);
  }, [result]);

  const grade = useMemo(() => {
    if (!result) return { grade: '—', color: '#9CA3AF', label: '' };
    return getScoreGrade(result.finalScore);
  }, [result]);

  const handleCopy = async () => {
    if (!result) return;
    const success = await copyResultsToClipboard(result, gpuInfo);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRetry = () => {
    setCopied(false);
    reset();
  };

  const handleClose = () => {
    useBenchmarkStore.setState({ phase: 'idle', result: null });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 50,
              pointerEvents: 'auto',
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 51,
              pointerEvents: 'auto',
              padding: '20px',
            }}
          >
            <GlassPanel
              strong
              id="result-modal"
              style={{
                width: '100%',
                maxWidth: '700px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '24px',
                fontFamily: "'Courier New', 'Fira Code', monospace",
              }}
            >
              {/* Terminal Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #334155',
                paddingBottom: '12px',
                marginBottom: '20px'
              }}>
                <span style={{ color: '#94A3B8', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  System_Log // Benchmark Status: COMPLETE
                </span>
                <span style={{ color: grade.color, fontWeight: 'bold' }}>
                  [{grade.grade}]
                </span>
              </div>

              {/* Terminal Readout */}
              <div style={{
                background: '#020617',
                border: '1px solid #334155',
                padding: '24px',
                borderRadius: '8px',
                marginBottom: '20px',
                color: '#E0F2FE',
                fontSize: '0.95rem',
                lineHeight: '1.8'
              }}>
                <div><span style={{ color: '#64748B' }}>{'>'}</span> INITIALIZING DIAGNOSTIC SEQUENCE... OK</div>
                <div><span style={{ color: '#64748B' }}>{'>'}</span> GPU: <span style={{ color: '#F8FAFC' }}>{gpuInfo.renderer}</span></div>
                <br />
                <div><span style={{ color: '#64748B' }}>{'>'}</span> FINAL SCORE : <strong style={{ color: '#38BDF8', fontSize: '1.25rem' }}>{result?.finalScore}</strong></div>
                <div><span style={{ color: '#64748B' }}>{'>'}</span> AVG_FPS     : <span style={{ color: '#F8FAFC' }}>{formatNumber(result?.averageFps)}</span></div>
                <div><span style={{ color: '#64748B' }}>{'>'}</span> LOW_1%_FPS  : <span style={{ color: '#F8FAFC' }}>{formatNumber(result?.low1PercentFps)}</span></div>
                <div><span style={{ color: '#64748B' }}>{'>'}</span> SPIKE_COUNT : <span style={{ color: '#F8FAFC' }}>{result?.frameTimeSpikes}</span></div>
                <div><span style={{ color: '#64748B' }}>{'>'}</span> VARIANCE    : <span style={{ color: '#F8FAFC' }}>{formatNumber(result?.stdDev, 2)} ms</span></div>
                <div><span style={{ color: '#64748B' }}>{'>'}</span> EVALUATION  : <span style={{ color: grade.color }}>{grade.label}</span></div>
              </div>

              {/* Frame Time Chart */}
              {chartData.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginBottom: '8px' }}>
                    {'>'} FRAME_TIME_DISTRIBUTION.DAT
                  </div>
                  <div style={{
                    border: '1px solid #334155',
                    padding: '12px 4px 4px 0',
                    background: '#020617',
                    borderRadius: '4px'
                  }}>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={chartData}>
                        <XAxis
                          dataKey="index"
                          tick={false}
                          axisLine={{ stroke: '#334155' }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#94A3B8' }}
                          axisLine={{ stroke: '#334155' }}
                          tickLine={false}
                          width={36}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#0F172A',
                            border: '1px solid #38BDF8',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#F3F4F6',
                          }}
                          formatter={(value) => [`${value} ms`, 'Frame Time']}
                          labelFormatter={() => ''}
                        />
                        <ReferenceLine
                          y={16.67}
                          stroke="#10B98140"
                          strokeDasharray="4 4"
                          label={{ value: '60fps', fill: '#10B981', fontSize: 9, position: 'left' }}
                        />
                        <ReferenceLine
                          y={33.33}
                          stroke="#F59E0B40"
                          strokeDasharray="4 4"
                          label={{ value: '30fps', fill: '#F59E0B', fontSize: 9, position: 'left' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="frameTime"
                          stroke="#38BDF8"
                          strokeWidth={1}
                          dot={false}
                          activeDot={{ r: 3, fill: '#38BDF8' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                borderTop: '1px solid #334155',
                paddingTop: '16px'
              }}>
                <CommandButton
                  id="btn-close"
                  onClick={handleClose}
                >
                  Close
                </CommandButton>
                <CommandButton
                  id="btn-retry"
                  onClick={handleRetry}
                >
                  Re-Run
                </CommandButton>
                <CommandButton
                  id="btn-copy-results"
                  variant="filled"
                  onClick={handleCopy}
                >
                  {copied ? '✓ Exported' : 'Export Log'}
                </CommandButton>
              </div>
            </GlassPanel>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
