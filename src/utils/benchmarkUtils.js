/**
 * benchmarkUtils.js — Score calculation, formatting, and grading utilities
 */

/**
 * Calculate comprehensive benchmark score from frame times
 * @param {number[]} frameTimes - Array of frame times in milliseconds
 * @returns {Object} Benchmark result metrics
 */
export function calculateScore(frameTimes) {
  if (!frameTimes || frameTimes.length === 0) {
    return { averageFps: 0, low1PercentFps: 0, frameTimeSpikes: 0, finalScore: 0 };
  }

  const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const averageFps = 1000 / avgFrameTime;

  const sorted = [...frameTimes].sort((a, b) => b - a);
  const onePercent = Math.max(1, Math.floor(sorted.length * 0.01));
  const low1Avg = sorted.slice(0, onePercent).reduce((a, b) => a + b, 0) / onePercent;
  const low1PercentFps = 1000 / low1Avg;

  const spikeThreshold = avgFrameTime * 2;
  const frameTimeSpikes = frameTimes.filter(t => t > spikeThreshold).length;

  const variance = frameTimes.reduce((sum, t) => sum + (t - avgFrameTime) ** 2, 0) / frameTimes.length;
  const stdDev = Math.sqrt(variance);

  const fpsScore = Math.min(averageFps / 60 * 100, 100) * 0.4;
  const lowScore = Math.min(low1PercentFps / 30 * 100, 100) * 0.3;
  const stabilityScore = Math.max(0, 100 - stdDev * 2) * 0.2;
  const spikePenalty = Math.max(0, 100 - (frameTimeSpikes / frameTimes.length) * 1000) * 0.1;
  const finalScore = Math.round(fpsScore + lowScore + stabilityScore + spikePenalty);

  return {
    averageFps: Math.round(averageFps * 10) / 10,
    low1PercentFps: Math.round(low1PercentFps * 10) / 10,
    frameTimeSpikes,
    finalScore: Math.max(0, Math.min(100, finalScore)),
    stdDev: Math.round(stdDev * 100) / 100,
    totalFrames: frameTimes.length,
  };
}

/**
 * Calculate 1% low frame time FPS
 */
export function calculateLow1Percent(frameTimes) {
  if (!frameTimes || frameTimes.length === 0) return 0;
  const sorted = [...frameTimes].sort((a, b) => b - a);
  const count = Math.max(1, Math.floor(sorted.length * 0.01));
  const avg = sorted.slice(0, count).reduce((a, b) => a + b, 0) / count;
  return Math.round((1000 / avg) * 10) / 10;
}

/**
 * Format number with fixed decimals
 */
export function formatNumber(num, decimals = 1) {
  if (typeof num !== 'number' || isNaN(num)) return '—';
  return num.toFixed(decimals);
}

/**
 * Get score grade (S through F)
 * @param {number} score - 0~100
 * @returns {{ grade: string, color: string, label: string }}
 */
export function getScoreGrade(score) {
  if (score >= 95) return { grade: 'S', color: '#FFD700', label: 'Legendary' };
  if (score >= 85) return { grade: 'A', color: '#00E5FF', label: 'Excellent' };
  if (score >= 70) return { grade: 'B', color: '#4ADE80', label: 'Great' };
  if (score >= 55) return { grade: 'C', color: '#FBBF24', label: 'Average' };
  if (score >= 40) return { grade: 'D', color: '#FB923C', label: 'Below Average' };
  return { grade: 'F', color: '#FF2A6D', label: 'Poor' };
}

/**
 * Downsample frame time data for chart rendering
 * @param {number[]} frameTimes
 * @param {number} maxPoints - Maximum data points
 * @returns {Array<{ index: number, frameTime: number, fps: number }>}
 */
export function downsampleForChart(frameTimes, maxPoints = 200) {
  if (!frameTimes || frameTimes.length === 0) return [];
  
  const step = Math.max(1, Math.floor(frameTimes.length / maxPoints));
  const result = [];

  for (let i = 0; i < frameTimes.length; i += step) {
    const slice = frameTimes.slice(i, Math.min(i + step, frameTimes.length));
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push({
      index: i,
      frameTime: Math.round(avg * 100) / 100,
      fps: Math.round((1000 / avg) * 10) / 10,
    });
  }

  return result;
}

/**
 * Copy benchmark results to clipboard as JSON
 */
export async function copyResultsToClipboard(result, gpuInfo) {
  const data = {
    benchmark: 'Black Hole Benchmark v1.0',
    timestamp: new Date().toISOString(),
    gpu: gpuInfo,
    results: {
      finalScore: result.finalScore,
      averageFps: result.averageFps,
      low1PercentFps: result.low1PercentFps,
      frameTimeSpikes: result.frameTimeSpikes,
      stdDev: result.stdDev,
      totalFrames: result.totalFrames,
    },
  };

  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    return true;
  } catch {
    console.error('[BHB] Failed to copy to clipboard');
    return false;
  }
}
