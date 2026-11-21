import { findBoardConflicts } from '../utils/sudokuValidator.js';

// Default endpoint for your backend server (e.g. FastAPI, Flask, Express, etc.)
export const DEFAULT_BACKEND_URL = 'http://localhost:8000/api/solve-sudoku';

export const SOLVER_MODES = [
  { id: 'classic', label: 'Classic MRV' },
  { id: 'smollm2-135m', label: 'MRV + SmolLM2 135M' },
  { id: 'smollm2-360m', label: 'MRV + SmolLM2 360M' },
];

export const SOLVER_METRICS = [
  ['elapsed_ms', 'Solver time (ms)'],
  ['attempts', 'Attempts'],
  ['backtracks', 'Backtracks'],
  ['model_calls', 'LLM calls'],
  ['invalid_model_responses', 'Invalid replies'],
  ['model_errors', 'Inference errors'],
];

/**
 * Helper to parse the response coming back from your LLM backend.
 * Adjust this if your backend returns a different JSON structure.
 */
export function parseBackendResponse(responseData, clues) {
  let solution;
  if (Array.isArray(responseData)) {
    solution = responseData;
  } else if (Array.isArray(responseData?.solution)) {
    solution = responseData.solution;
  } else if (Array.isArray(responseData?.board)) {
    solution = responseData.board;
  } else {
    throw new Error('Unsupported backend response. Expected a Sudoku solution.');
  }

  const isCompleteGrid = solution.length === 9 && solution.every(row =>
    Array.isArray(row) && row.length === 9 &&
    row.every(value => Number.isInteger(value) && value >= 1 && value <= 9)
  );
  if (!isCompleteGrid) {
    throw new Error('The solution must be a 9×9 grid of integers from 1 to 9.');
  }
  if (findBoardConflicts(solution).size > 0) {
    throw new Error('The solution contains duplicate digits in a row, column, or 3×3 box.');
  }
  if (clues?.some((row, r) => row.some((value, c) => value != null && value !== 0 && value !== solution[r][c]))) {
    throw new Error('The solution changes one or more of the original clues.');
  }
  return solution;
}

export function buildRequestBody(board, mode = 'classic') {
  return {
    sudoku_board: board,
    format: 'GRID_2D',
    method: mode === 'classic' ? 'classic' : 'hybrid',
    model: mode === 'classic' ? null : mode
  };
}

/**
 * Primary function that communicates with the LLM backend.
 * 
 * @param {number[][]} board - Current 9x9 Sudoku grid (0 for empty)
 * @param {Object} config - Connection and formatting options
 * @param {string} config.endpoint - Backend API URL
 * @param {string} config.apiKey - Optional API key/Bearer token for your backend
 * @param {string} config.mode - Solver mode from SOLVER_MODES
 * @param {boolean} config.useMock - Run the local solver instead of sending a request
 * @param {AbortSignal} config.signal - Optional AbortSignal to cancel request
 * @returns {Promise<{ solution: number[][], rawResponse: any, latencyMs: number, fromMock: boolean }>}
 */
export async function solveSudokuWithLLM(board, config = {}) {
  const {
    endpoint = DEFAULT_BACKEND_URL,
    apiKey = '',
    mode = 'classic',
    useMock = false,
    signal
  } = config;

  const startTime = performance.now();

  // If mock mode is explicitly requested, run the simulation
  if (useMock) {
    return await simulateMockLLM(board, startTime);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const token = apiKey.trim().replace(/^Bearer(?:\s+|$)/i, '');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const requestBody = buildRequestBody(board, mode);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request was cancelled.');
    }
    throw new Error(
      `Failed to connect to backend at "${endpoint}". Ensure your backend server is running and CORS is enabled. (${err.message})`
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.message || `Backend returned HTTP ${response.status}.`);
    error.stats = body?.stats;
    throw error;
  }

  let json;
  try {
    json = await response.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request was cancelled.');
    throw new Error('Could not read the backend response as JSON.');
  }

  return {
    solution: parseBackendResponse(json, board),
    rawResponse: json,
    stats: json.stats,
    latencyMs: Math.round(performance.now() - startTime),
    fromMock: false
  };
}

/**
 * Mock solver simulation (for previewing the UI without a backend).
 * Resolves valid board using standard backtracking to demonstrate frontend animations.
 */
async function simulateMockLLM(board, startTime) {
  // Simulate network/LLM inference delay (750ms)
  await new Promise(resolve => setTimeout(resolve, 750));

  // Deep clone board
  const grid = board.map(r => [...r]);

  function isValid(g, r, c, k) {
    for (let i = 0; i < 9; i++) {
      const m = 3 * Math.floor(r / 3) + Math.floor(i / 3);
      const n = 3 * Math.floor(c / 3) + (i % 3);
      if (g[r][i] === k || g[i][c] === k || g[m][n] === k) {
        return false;
      }
    }
    return true;
  }

  function solve(g) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!g[r][c] || g[r][c] === 0) {
          for (let k = 1; k <= 9; k++) {
            if (isValid(g, r, c, k)) {
              g[r][c] = k;
              if (solve(g)) return true;
              g[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  const solvable = solve(grid);
  if (!solvable) {
    throw new Error('Mock Solver: This board has no valid Sudoku solution.');
  }

  return {
    solution: grid,
    rawResponse: {
      status: 'success',
      provider: 'mock_simulation',
      note: 'This is a simulated response. Connect your real backend by setting the API URL and unchecking Mock mode.'
    },
    latencyMs: Math.round(performance.now() - startTime),
    fromMock: true
  };
}
