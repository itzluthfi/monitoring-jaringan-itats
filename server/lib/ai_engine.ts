/**
 * Local AI Engine using TensorFlow.js
 * 
 * Model Architecture: 1D-CNN for Time-Series Forecasting
 * - Input: Last N data points of client counts (time-series window)
 * - Output: Predicted client count for next hour + density classification
 * 
 * This replaces mock predictions with real ML inference.
 */

import * as tf from '@tensorflow/tfjs';

// Silence TF logs
tf.env().set('IS_BROWSER', false);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HistoryPoint {
  timestamp: string;
  client_count: number;
}

export interface AiPredictionResult {
  prediction: string;
  rawanHours: { hour: string; expectedDensity: string }[];
  modelInfo: {
    type: string;
    dataPoints: number;
    trainingLoss?: number;
    isLocal: boolean;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WINDOW_SIZE = 12; // Use last 12 data points as input window
const EPOCHS = 50;
const BATCH_SIZE = 16;

let cachedModel: tf.Sequential | null = null;
let lastTrainedAt: number = 0;
let cachedNormParams: { min: number; max: number } | null = null;
let cachedTrainingLoss: number | undefined;
const MODEL_CACHE_MS = 30 * 60 * 1000; // Re-train at most every 30 minutes

// ── FIX #2: Training lock — mencegah training berjalan bersamaan ──
// Jika ada 5 user buka dashboard bersamaan, hanya 1 training yang berjalan.
// Request lain menunggu promise yang sama selesai.
let isTraining = false;
let trainingPromise: Promise<void> | null = null;

// ─── Model Builder ─────────────────────────────────────────────────────────
function buildModel(windowSize: number): tf.Sequential {
  const model = tf.sequential();

  // 1D-CNN layer to detect local temporal patterns
  model.add(tf.layers.conv1d({
    inputShape: [windowSize, 1],
    filters: 32,
    kernelSize: 3,
    padding: 'same',
    activation: 'relu',
  }));

  model.add(tf.layers.maxPooling1d({ poolSize: 2 }));

  // Second CNN layer for higher-level patterns
  model.add(tf.layers.conv1d({
    filters: 64,
    kernelSize: 3,
    padding: 'same',
    activation: 'relu',
  }));

  model.add(tf.layers.globalAveragePooling1d());

  // Dense layers for regression output
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 1 })); // Single output: next count

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mse'],
  });

  return model;
}

// ─── Data Preprocessing ───────────────────────────────────────────────────
function normalizeData(values: number[]): { normalized: number[]; min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return {
    normalized: values.map(v => (v - min) / range),
    min,
    max,
  };
}

function denormalize(value: number, min: number, max: number): number {
  return Math.round(value * (max - min) + min);
}

function createWindows(data: number[], windowSize: number): { X: number[][]; y: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = windowSize; i < data.length; i++) {
    X.push(data.slice(i - windowSize, i));
    y.push(data[i]);
  }
  return { X, y };
}

// ─── Training ─────────────────────────────────────────────────────────────
async function trainModel(history: HistoryPoint[]): Promise<{ model: tf.Sequential; loss: number; normParams: { min: number; max: number } }> {
  const counts = history.map(h => Number(h.client_count) || 0);
  const { normalized, min, max } = normalizeData(counts);
  const { X, y } = createWindows(normalized, WINDOW_SIZE);

  if (X.length < 5) {
    throw new Error('Not enough data windows for training');
  }

  // Convert to tensors
  const xs = tf.tensor3d(X.map(w => w.map(v => [v])));
  const ys = tf.tensor2d(y.map(v => [v]));

  const model = buildModel(WINDOW_SIZE);

  let finalLoss = 0;
  await model.fit(xs, ys, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    shuffle: true,
    validationSplit: 0.1,
    callbacks: {
      onEpochEnd: (epoch: number, logs: any) => {
        if (logs) finalLoss = logs.loss;
      },
    },
    verbose: 0,
  });

  xs.dispose();
  ys.dispose();

  return { model, loss: finalLoss, normParams: { min, max } };
}

// ─── Inference ────────────────────────────────────────────────────────────
async function predictNextHours(
  model: tf.Sequential,
  lastWindow: number[],
  normParams: { min: number; max: number },
  hoursAhead: number = 24
): Promise<number[]> {
  const predictions: number[] = [];
  const { min, max } = normParams;

  // Normalize the last window
  const window = lastWindow.slice(-WINDOW_SIZE).map(v => (v - min) / (max - min || 1));

  let currentWindow = [...window];

  for (let i = 0; i < hoursAhead; i++) {
    const input = tf.tensor3d([currentWindow.map(v => [v])]);
    const pred = model.predict(input) as tf.Tensor;
    const predValue = (await pred.data())[0];
    input.dispose();
    pred.dispose();

    predictions.push(denormalize(predValue, min, max));
    currentWindow = [...currentWindow.slice(1), predValue];
  }

  return predictions.map(p => Math.max(0, p));
}

// ─── Classification ───────────────────────────────────────────────────────
function classifyDensity(count: number, maxObserved: number): string {
  const ratio = count / (maxObserved || 1);
  if (ratio >= 0.6) return 'High';
  if (ratio >= 0.3) return 'Medium';
  return 'Low';
}

function getHourLabel(hoursFromNow: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow, 0, 0, 0);
  const h = d.getHours().toString().padStart(2, '0');
  const hNext = ((d.getHours() + 1) % 24).toString().padStart(2, '0');
  return `${h}:00 - ${hNext}:00`;
}

// ─── Rule-based fallback predictor ────────────────────────────────────────
/**
 * Hour-of-day heuristic predictor — used when ML data is insufficient.
 * Based on typical campus patterns.
 */
function ruleBasedPrediction(history: HistoryPoint[]): AiPredictionResult {
  // Compute average per hour-of-day from history
  const hourly: Record<number, number[]> = {};
  history.forEach(h => {
    const hour = new Date(h.timestamp).getHours();
    if (!hourly[hour]) hourly[hour] = [];
    hourly[hour].push(Number(h.client_count) || 0);
  });

  const hourlyAvg: Record<number, number> = {};
  for (let h = 0; h < 24; h++) {
    const vals = hourly[h] || [0];
    hourlyAvg[h] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const maxAvg = Math.max(...Object.values(hourlyAvg), 1);
  const now = new Date().getHours();

  const rawanHours = [];
  for (let offset = 1; offset <= 12; offset++) {
    const hr = (now + offset) % 24;
    const density = classifyDensity(hourlyAvg[hr] || 0, maxAvg);
    rawanHours.push({ hour: getHourLabel(offset), expectedDensity: density });
  }

  const highHours = rawanHours.filter(h => h.expectedDensity === 'High');
  const trend = highHours.length > 3
    ? `Peak usage expected around ${highHours[0].hour}.`
    : 'Moderate to low traffic expected based on historical averages.';

  return {
    prediction: `[Rule-Based AI] ${trend} Analyzed ${history.length} historical data points from this network.`,
    rawanHours,
    modelInfo: { type: 'rule-based', dataPoints: history.length, isLocal: true },
  };
}

// ─── Main Export: Smart Predict ────────────────────────────────────────────
export async function smartPredict(history: HistoryPoint[]): Promise<AiPredictionResult> {
  if (!history || history.length < 5) {
    return {
      prediction: 'Insufficient data for AI prediction. Collecting more network snapshots...',
      rawanHours: [],
      modelInfo: { type: 'none', dataPoints: history?.length || 0, isLocal: true },
    };
  }

  // Use rule-based if not enough data for deep learning
  if (history.length < WINDOW_SIZE + 5) {
    return ruleBasedPrediction(history);
  }

  try {
    const now = Date.now();

    // ── Re-use cached model jika masih segar ──
    if (cachedModel && cachedNormParams && (now - lastTrainedAt) < MODEL_CACHE_MS) {
      // Langsung inferensi tanpa training
      const counts = history.map(h => Number(h.client_count) || 0);
      const lastWindow = counts.slice(-WINDOW_SIZE);
      const maxObserved = Math.max(...counts, 1);
      const futureCounts = await predictNextHours(cachedModel, lastWindow, cachedNormParams, 12);
      const rawanHours = futureCounts.map((count, i) => ({
        hour: getHourLabel(i + 1),
        expectedDensity: classifyDensity(count, maxObserved),
      }));
      const highHours = rawanHours.filter(h => h.expectedDensity === 'High');
      const peakMsg = highHours.length > 0
        ? `CNN predicts peak usage at ${highHours.map(h => h.hour).slice(0, 2).join(', ')}.`
        : 'Low to moderate traffic predicted for the next 12 hours.';
      return {
        prediction: `[CNN AI — Local Model] ${peakMsg} Model trained on ${history.length} data points. Loss: ${cachedTrainingLoss?.toFixed(4) || 'cached'}.`,
        rawanHours,
        modelInfo: { type: 'cnn-1d', dataPoints: history.length, trainingLoss: cachedTrainingLoss, isLocal: true },
      };
    }

    // ── FIX #2: Jika sedang training, tunggu promise yang sama ──
    if (isTraining && trainingPromise) {
      console.log('[AI-Engine] Training sedang berjalan, menunggu selesai...');
      await trainingPromise;
      // Setelah training selesai, gunakan cached model
      if (cachedModel && cachedNormParams) {
        const counts = history.map(h => Number(h.client_count) || 0);
        const lastWindow = counts.slice(-WINDOW_SIZE);
        const maxObserved = Math.max(...counts, 1);
        const futureCounts = await predictNextHours(cachedModel, lastWindow, cachedNormParams, 12);
        const rawanHours = futureCounts.map((count, i) => ({
          hour: getHourLabel(i + 1),
          expectedDensity: classifyDensity(count, maxObserved),
        }));
        return {
          prediction: `[CNN AI — Shared Training] Model trained on ${history.length} data points.`,
          rawanHours,
          modelInfo: { type: 'cnn-1d', dataPoints: history.length, trainingLoss: cachedTrainingLoss, isLocal: true },
        };
      }
    }

    // ── Training baru diperlukan ──
    let resolveTraining!: () => void;
    trainingPromise = new Promise<void>(resolve => { resolveTraining = resolve; });
    isTraining = true;

    try {
      console.log('[AI-Engine] Training CNN model on', history.length, 'data points...');
      const result = await trainModel(history);

      if (cachedModel) cachedModel.dispose(); // Buang model lama agar tidak leak memory
      cachedModel = result.model;
      cachedNormParams = result.normParams;
      cachedTrainingLoss = result.loss;
      lastTrainedAt = Date.now();
      console.log(`[AI-Engine] Training complete. Final loss: ${cachedTrainingLoss?.toFixed(6)}`);
    } finally {
      isTraining = false;
      resolveTraining(); // Bebaskan semua yang sedang menunggu
      trainingPromise = null;
    }

    // ── Inferensi dengan model yang baru dilatih atau cache ──
    const counts = history.map(h => Number(h.client_count) || 0);
    const lastWindow = counts.slice(-WINDOW_SIZE);
    const maxObserved = Math.max(...counts, 1);

    const futureCounts = await predictNextHours(cachedModel!, lastWindow, cachedNormParams!, 12);

    const rawanHours = futureCounts.map((count, i) => ({
      hour: getHourLabel(i + 1),
      expectedDensity: classifyDensity(count, maxObserved),
    }));

    const highHours = rawanHours.filter(h => h.expectedDensity === 'High');
    const peakMsg = highHours.length > 0
      ? `CNN predicts peak usage at ${highHours.map(h => h.hour).slice(0, 2).join(', ')}.`
      : 'Low to moderate traffic predicted for the next 12 hours.';

    return {
      prediction: `[CNN AI — Local Model] ${peakMsg} Model trained on ${history.length} data points. Loss: ${cachedTrainingLoss?.toFixed(4) || 'cached'}.`,
      rawanHours,
      modelInfo: { type: 'cnn-1d', dataPoints: history.length, trainingLoss: cachedTrainingLoss, isLocal: true },
    };
  } catch (err: any) {
    console.error('[AI-Engine] CNN prediction failed, falling back to rule-based:', err.message);
    isTraining = false;
    trainingPromise = null;
    return ruleBasedPrediction(history);
  }
}

// ─── Model Status ─────────────────────────────────────────────────────────
export function getModelStatus() {
  return {
    hasModel: cachedModel !== null,
    isTraining,
    lastTrainedAt: lastTrainedAt > 0 ? new Date(lastTrainedAt).toISOString() : null,
    modelType: 'CNN-1D (TensorFlow.js)',
    framework: 'TensorFlow.js',
    windowSize: WINDOW_SIZE,
    epochs: EPOCHS,
    trainingLoss: cachedTrainingLoss,
    cacheExpiresIn: cachedModel && lastTrainedAt
      ? Math.max(0, Math.round((MODEL_CACHE_MS - (Date.now() - lastTrainedAt)) / 1000 / 60)) + ' menit'
      : null,
  };
}

export function clearModelCache() {
  if (cachedModel) {
    cachedModel.dispose();
    cachedModel = null;
    lastTrainedAt = 0;
  }
}
