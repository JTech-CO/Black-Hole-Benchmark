/**
 * useBenchmarkStore.js — Zustand global state for benchmark lifecycle
 * 
 * Manages: benchmark phase, frame times, HUD data, results, errors
 * Optimized: use selectors to minimize React re-renders during benchmark
 */

import { create } from 'zustand';

const LEVEL_NAMES = [
  'Level 1 — Warm-up',
  'Level 2 — Moderate',
  'Level 3 — Intense',
  'Level 4 — Extreme',
];

const useBenchmarkStore = create((set, get) => ({
  // ─── Benchmark State ───
  phase: 'idle', // 'idle' | 'running' | 'finished'
  currentLevel: 0,
  currentLevelName: 'Explore Mode',
  frameTimes: [],
  progress: 0,

  // ─── Real-time HUD Data ───
  currentFps: 0,
  low1PercentFps: 0,
  resolution: { width: 0, height: 0 },

  // ─── GPU Info ───
  gpuInfo: { vendor: '', renderer: '' },

  // ─── Result ───
  result: null,

  // ─── Error ───
  error: null,

  // ─── Actions ───
  startBenchmark: () => set({
    phase: 'running',
    currentLevel: 0,
    currentLevelName: LEVEL_NAMES[0],
    frameTimes: [],
    result: null,
    error: null,
    progress: 0,
  }),

  stopBenchmark: () => set({
    phase: 'idle',
    currentLevelName: 'Explore Mode',
    progress: 0,
  }),

  setCurrentLevel: (level) => set({
    currentLevel: level,
    currentLevelName: LEVEL_NAMES[level] || 'Unknown',
  }),

  addFrameTime: (time) => {
    const { frameTimes } = get();
    frameTimes.push(time);
    // Don't trigger re-render for every frame — array is mutated directly
  },

  setCurrentFps: (fps) => set({ currentFps: Math.round(fps * 10) / 10 }),

  setResolution: (res) => set({ resolution: res }),

  setProgress: (p) => set({ progress: p }),

  setResult: (result) => set({
    phase: 'finished',
    result,
    currentLevelName: 'Benchmark Complete',
    progress: 1,
  }),

  setError: (error) => set({ error }),

  setGpuInfo: (info) => set({ gpuInfo: info }),

  reset: () => set({
    phase: 'idle',
    currentLevel: 0,
    currentLevelName: 'Explore Mode',
    frameTimes: [],
    progress: 0,
    currentFps: 0,
    result: null,
    error: null,
  }),
}));

export default useBenchmarkStore;
