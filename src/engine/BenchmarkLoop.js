import { WebGLContext } from './WebGLContext.js';

const LEVELS = [
  { name: 'Level 1 — Warm-up',    steps: 80,  spin: 0.3, enableDisk: true,  duration: 15 },
  { name: 'Level 2 — Moderate',    steps: 150, spin: 0.6, enableDisk: true,  duration: 15 },
  { name: 'Level 3 — Intense',     steps: 300, spin: 0.85, enableDisk: true,  duration: 15 },
  { name: 'Level 4 — Extreme',     steps: 500, spin: 0.998, enableDisk: true, duration: 15 },
];

const MASS = 1.5;

export class BenchmarkLoop {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.store = store;
    this.webgl = null;
    this.rafId = null;
    this.isRunning = false;
    this.isExploreMode = false;

    // Timing
    this.startTime = 0;
    this.lastFrameTime = 0;
    this.levelStartTime = 0;
    this.currentLevel = 0;

    // Camera orbit
    this.cameraTheta = 1.2;  // Polar angle (~69° from top, nice tilted view)
    this.cameraPhi = 0.0;
    this.cameraRadius = 20.0; // Camera at r=20, well outside photon sphere (r=4.5)
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Bound methods
    this._tick = this._tick.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onWheel = this._onWheel.bind(this);
  }

  init() {
    this.webgl = new WebGLContext(
      this.canvas,
      () => this._handleContextLost(),
      () => this._handleContextRestored()
    );

    const success = this.webgl.init();
    if (!success) {
      this.store.getState().setError('WebGL 2.0을 지원하지 않는 브라우저입니다. Chrome, Edge, Firefox 최신 버전을 사용해주세요.');
      return false;
    }

    // Get GPU info
    const gpuInfo = this.webgl.getRendererInfo();
    this.store.getState().setGpuInfo(gpuInfo);

    // Attach orbit controls
    this._attachControls();

    // Start explore mode (idle rendering with low step count)
    this.isExploreMode = true;
    this.startTime = performance.now() / 1000;
    this.lastFrameTime = performance.now();
    this._tick();

    return true;
  }

  startBenchmark() {
    const state = this.store.getState();
    state.startBenchmark();

    this.isExploreMode = false;
    this.isRunning = true;
    this.currentLevel = 0;
    this.levelStartTime = performance.now();
    this.lastFrameTime = performance.now();

    state.setCurrentLevel(0);
  }

  stopBenchmark() {
    this.isRunning = false;
    this.isExploreMode = true;
    this.store.getState().stopBenchmark();
  }

  _tick() {
    if (this.webgl?.isContextLost) {
      this.rafId = requestAnimationFrame(this._tick);
      return;
    }

    const now = performance.now();
    const deltaMs = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Resize if needed
    const resolution = this.webgl.resize();

    // Update camera position
    this._updateCamera();

    // Determine shader parameters
    const time = (now / 1000) - this.startTime;
    let params;

    if (this.isRunning) {
      const level = LEVELS[this.currentLevel];
      const levelElapsed = (now - this.levelStartTime) / 1000;

      // Check level transition
      if (levelElapsed >= level.duration) {
        this.currentLevel++;
        if (this.currentLevel >= LEVELS.length) {
          // Benchmark complete
          this._completeBenchmark();
          this.rafId = requestAnimationFrame(this._tick);
          return;
        }
        this.levelStartTime = now;
        this.store.getState().setCurrentLevel(this.currentLevel);
      }

      const currentLevel = LEVELS[this.currentLevel];
      params = {
        time,
        mass: MASS,
        spin: currentLevel.spin,
        steps: currentLevel.steps,
        enableDisk: currentLevel.enableDisk,
        cameraPos: this._getCameraPos(),
        cameraRot: this._getCameraRotMatrix(),
        isIdle: false,
      };

      // Record frame time
      const state = this.store.getState();
      state.addFrameTime(deltaMs);

      // Update HUD (throttled — every ~100ms)
      if (now - (this._lastHudUpdate || 0) > 100) {
        this._lastHudUpdate = now;
        const fps = 1000 / Math.max(deltaMs, 0.1);
        state.setCurrentFps(fps);
        state.setResolution(resolution);
        
        // Calculate progress
        const totalDuration = LEVELS.reduce((sum, l) => sum + l.duration, 0);
        const elapsed = LEVELS.slice(0, this.currentLevel).reduce((sum, l) => sum + l.duration, 0)
          + (now - this.levelStartTime) / 1000;
        state.setProgress(Math.min(elapsed / totalDuration, 1.0));
      }
    } else {
      // Explore mode — gentle rendering
      params = {
        time,
        mass: MASS,
        spin: 0.7,
        steps: 200,
        enableDisk: true,
        cameraPos: this._getCameraPos(),
        cameraRot: this._getCameraRotMatrix(),
        isIdle: true,
      };

      // Slow auto-orbit in explore mode
      if (!this.isDragging) {
        this.cameraPhi += 0.002;
      }

      // Update resolution display
      if (now - (this._lastHudUpdate || 0) > 500) {
        this._lastHudUpdate = now;
        const fps = 1000 / Math.max(deltaMs, 0.1);
        this.store.getState().setCurrentFps(fps);
        this.store.getState().setResolution(resolution);
      }
    }

    // Render
    this.webgl.setParams(params);
    this.webgl.render();

    this.rafId = requestAnimationFrame(this._tick);
  }

  _completeBenchmark() {
    this.isRunning = false;
    this.isExploreMode = true;

    const state = this.store.getState();
    const frameTimes = state.frameTimes;

    if (frameTimes.length === 0) return;

    // Calculate metrics
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const averageFps = 1000 / avgFrameTime;

    // 1% Low — sort ascending, take bottom 1%
    const sorted = [...frameTimes].sort((a, b) => b - a); // Slowest first
    const onePercent = Math.max(1, Math.floor(sorted.length * 0.01));
    const low1PercentFrameTime = sorted.slice(0, onePercent).reduce((a, b) => a + b, 0) / onePercent;
    const low1PercentFps = 1000 / low1PercentFrameTime;

    // Frame time spikes (>2x average)
    const spikeThreshold = avgFrameTime * 2;
    const frameTimeSpikes = frameTimes.filter(t => t > spikeThreshold).length;

    // Variance
    const variance = frameTimes.reduce((sum, t) => sum + (t - avgFrameTime) ** 2, 0) / frameTimes.length;
    const stdDev = Math.sqrt(variance);

    // Final score calculation
    // Weighted: 40% avg FPS + 30% 1% Low + 20% stability + 10% spike penalty
    const fpsScore = Math.min(averageFps / 60 * 100, 100) * 0.4;
    const lowScore = Math.min(low1PercentFps / 30 * 100, 100) * 0.3;
    const stabilityScore = Math.max(0, 100 - stdDev * 2) * 0.2;
    const spikePenalty = Math.max(0, 100 - (frameTimeSpikes / frameTimes.length) * 1000) * 0.1;
    const finalScore = Math.round(fpsScore + lowScore + stabilityScore + spikePenalty);

    state.setResult({
      averageFps: Math.round(averageFps * 10) / 10,
      low1PercentFps: Math.round(low1PercentFps * 10) / 10,
      frameTimeSpikes,
      finalScore: Math.max(0, Math.min(100, finalScore)),
      stdDev: Math.round(stdDev * 100) / 100,
      totalFrames: frameTimes.length,
      frameTimes: frameTimes, // For chart
    });
  }

  _getCameraPos() {
    return [
      this.cameraRadius * Math.sin(this.cameraTheta) * Math.cos(this.cameraPhi),
      this.cameraRadius * Math.cos(this.cameraTheta),
      this.cameraRadius * Math.sin(this.cameraTheta) * Math.sin(this.cameraPhi),
    ];
  }

  _getCameraRotMatrix() {
    const pos = this._getCameraPos();
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    // Look-at matrix (3x3 rotation only)
    const f = normalize3(sub3(target, pos));
    const r = normalize3(cross3(f, up));
    const u = cross3(r, f);

    // Column-major for WebGL
    return [
      r[0], u[0], -f[0],
      r[1], u[1], -f[1],
      r[2], u[2], -f[2],
    ];
  }

  _updateCamera() {
    // Clamp theta to avoid gimbal lock
    this.cameraTheta = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraTheta));
  }

  _attachControls() {
    const c = this.canvas;
    c.addEventListener('mousedown', this._onMouseDown);
    c.addEventListener('mousemove', this._onMouseMove);
    c.addEventListener('mouseup', this._onMouseUp);
    c.addEventListener('mouseleave', this._onMouseUp);
    c.addEventListener('touchstart', this._onTouchStart, { passive: false });
    c.addEventListener('touchmove', this._onTouchMove, { passive: false });
    c.addEventListener('touchend', this._onTouchEnd);
    c.addEventListener('wheel', this._onWheel, { passive: false });
  }

  _detachControls() {
    const c = this.canvas;
    c.removeEventListener('mousedown', this._onMouseDown);
    c.removeEventListener('mousemove', this._onMouseMove);
    c.removeEventListener('mouseup', this._onMouseUp);
    c.removeEventListener('mouseleave', this._onMouseUp);
    c.removeEventListener('touchstart', this._onTouchStart);
    c.removeEventListener('touchmove', this._onTouchMove);
    c.removeEventListener('touchend', this._onTouchEnd);
    c.removeEventListener('wheel', this._onWheel);
  }

  _onMouseDown(e) { this.isDragging = true; this.lastMouseX = e.clientX; this.lastMouseY = e.clientY; }
  _onMouseMove(e) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.cameraPhi -= dx * 0.005;
    this.cameraTheta += dy * 0.005;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }
  _onMouseUp() { this.isDragging = false; }
  
  _onWheel(e) {
    if (this.isExploreMode || this.isRunning) {
      e.preventDefault();
      // Adjust array multiplier for sensitivity
      this.cameraRadius += e.deltaY * 0.05;
      // Clamp between 8 (close) and 50 (far)
      this.cameraRadius = Math.max(8.0, Math.min(50.0, this.cameraRadius));
    }
  }

  _onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    this.isDragging = true;
    this.lastMouseX = t.clientX;
    this.lastMouseY = t.clientY;
  }
  _onTouchMove(e) {
    e.preventDefault();
    if (!this.isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - this.lastMouseX;
    const dy = t.clientY - this.lastMouseY;
    this.cameraPhi -= dx * 0.005;
    this.cameraTheta += dy * 0.005;
    this.lastMouseX = t.clientX;
    this.lastMouseY = t.clientY;
  }
  _onTouchEnd() { this.isDragging = false; }

  _handleContextLost() {
    this.store.getState().setError('GPU가 응답하지 않습니다. 잠시 후 자동 복구를 시도합니다...');
    if (this.isRunning) {
      this.stopBenchmark();
    }
  }

  _handleContextRestored() {
    this.store.getState().setError(null);
    this.webgl.resize();
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this._detachControls();
    this.webgl?.destroy();
  }
}

// ─── Vector math helpers ───
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize3(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
}
