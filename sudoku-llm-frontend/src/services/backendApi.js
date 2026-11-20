/**
 * ==============================================================================
 * BACKEND INTEGRATION SERVICE FOR LLM SUDOKU SOLVER
 * ==============================================================================
 * 
 * SPACE FOR SENDING DATA/VALUES TO YOUR BACKEND:
 * 
 * 1. Configure the `DEFAULT_BACKEND_URL` below or update it dynamically in the UI.
 * 2. Adapt `formatPayload()` to match whatever format your backend expects.
 * 3. Adapt `parseBackendResponse()` to match the JSON response structure of your LLM.
 * 
 * * Note: No backend is implemented here as requested. A mock solver is included
 * solely for local development and UI testing before your backend is connected.
 */

// Default endpoint for your backend server (e.g. FastAPI, Flask, Express, etc.)
export const DEFAULT_BACKEND_URL = 'http://localhost:8000/api/solve-sudoku';

/**
 * Payload formats supported out-of-the-box.
 * You can select which format your backend/LLM prefers.
 */
export const PayloadFormat = {
  GRID_2D: 'GRID_2D',       // 9x9 2D array: [[5, 3, 0, ...], [6, 0, 0, ...]]
  STRING_81: 'STRING_81',   // 81-char string: "530070000600195000..." (0 or . for empty)
  COORDINATES: 'COORDINATES', // Array of known cells: [{ row: 0, col: 0, value: 5 }, ...]
  PROMPT_TEXT: 'PROMPT_TEXT'  // Plain text grid formatted for direct LLM prompts
};

/**
 * Helper to transform the 9x9 board into various common LLM payload formats.
 * Modify this function if your backend expects a custom schema.
 */
export function formatPayload(board, format = PayloadFormat.GRID_2D) {
  switch (format) {
    case PayloadFormat.STRING_81:
      return board.flat().map(val => (val === 0 || val === null ? '0' : String(val))).join('');

    case PayloadFormat.COORDINATES:
      const knownCells = [];
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c] && board[r][c] !== 0) {
            knownCells.push({ row: r, col: c, value: board[r][c] });
          }
        }
      }
      return knownCells;

    case PayloadFormat.PROMPT_TEXT:
      return board
        .map(row => row.map(v => (v === 0 || v === null ? '.' : v)).join(' '))
        .join('\n');

    case PayloadFormat.GRID_2D:
    default:
      // Standard 9x9 matrix: 0 represents an empty cell
      return board.map(row => row.map(val => (val ? Number(val) : 0)));
  }
}

/**
 * Helper to parse the response coming back from your LLM backend.
 * Adjust this if your backend returns a different JSON structure.
 */
export function parseBackendResponse(responseData) {
  // Scenario A: Backend returns { solution: [[...], [...]] }
  if (responseData.solution && Array.isArray(responseData.solution)) {
    return responseData.solution;
  }

  // Scenario B: Backend returns { board: [[...]] }
  if (responseData.board && Array.isArray(responseData.board)) {
    return responseData.board;
  }

  // Scenario C: Backend returns 81-character string: { solution: "534678912..." }
  if (typeof responseData.solution === 'string' && responseData.solution.length >= 81) {
    const cleanStr = responseData.solution.replace(/[^0-9]/g, '');
    const grid = [];
    for (let r = 0; r < 9; r++) {
      grid.push(cleanStr.slice(r * 9, (r + 1) * 9).split('').map(Number));
    }
    return grid;
  }

  // Scenario D: Backend returns direct 2D array: [[...], [...]]
  if (Array.isArray(responseData) && responseData.length === 9) {
    return responseData;
  }

  throw new Error('Unsupported response structure from backend. Please adjust parseBackendResponse().');
}

/**
 * Primary function that communicates with the LLM backend.
 * 
 * @param {number[][]} board - Current 9x9 Sudoku grid (0 for empty)
 * @param {Object} config - Connection and formatting options
 * @param {string} config.endpoint - Backend API URL
 * @param {string} config.apiKey - Optional API key/Bearer token for your backend
 * @param {string} config.payloadFormat - Payload format from PayloadFormat
 * @param {boolean} config.useMock - Fallback to mock solver if backend is not running yet
 * @param {AbortSignal} config.signal - Optional AbortSignal to cancel request
 * @returns {Promise<{ solution: number[][], rawResponse: any, latencyMs: number }>}
 */
export async function solveSudokuWithLLM(board, config = {}) {
  const {
    endpoint = DEFAULT_BACKEND_URL,
    apiKey = '',
    payloadFormat = PayloadFormat.GRID_2D,
    useMock = false,
    signal
  } = config;

  const startTime = performance.now();

  // If mock mode is explicitly requested, run the simulation
  if (useMock) {
    return await simulateMockLLM(board, startTime);
  }

  // 1. Prepare request payload
  // ==========================================================================
  // [SPACE FOR BACKEND VALUES]:
  // Add any additional fields your backend needs here (e.g. model name,
  // temperature, prompt template, system prompt, max_tokens, etc.)
  // ==========================================================================
  const requestBody = {
    // The Sudoku board data in the chosen format:
    sudoku_board: formatPayload(board, payloadFormat),
    format: payloadFormat,
    
    // Optional LLM parameters you can forward to your backend:
    model_params: {
      temperature: 0.1, // Typically low for deterministic logical reasoning
      task: 'solve_sudoku'
    },
    
    // Metadata
    timestamp: new Date().toISOString()
  };

  // 2. Prepare headers (including Auth if your backend requires it)
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // 3. Send HTTP POST request to backend
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Backend returned status ${response.status}: ${errorText || response.statusText}`
      );
    }

    const json = await response.json();
    const solution = parseBackendResponse(json);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      solution,
      rawResponse: json,
      latencyMs,
      fromMock: false
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request was cancelled.');
    }
    // Re-throw with clear message
    throw new Error(
      `Failed to connect to backend at "${endpoint}". Ensure your backend server is running and CORS is enabled. (${err.message})`
    );
  }
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
