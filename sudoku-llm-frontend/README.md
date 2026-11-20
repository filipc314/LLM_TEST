# React Frontend for LLM Sudoku Resolver

A React frontend for solving Sudoku puzzles using your custom LLM backend model. It presents the Sudoku board in a standard 9x9 table format with 3x3 block separation, allows inputting known numbers, validates conflicts in real time, and provides a dedicated integration service to send board states to your LLM backend.

---

## 🚀 Quick Start

### Option 1: Instant Standalone Preview (No Node/npm installation required)
Because Python 3 is installed on your Mac, you can preview and test the complete React app immediately in your browser:

```bash
python3 -m http.server 3000
```
Then open [http://localhost:3000/standalone.html](http://localhost:3000/standalone.html) in your browser (or simply double-click `standalone.html` to open it in Safari/Chrome).

### Option 2: Standard Vite + React Workflow (Requires Node.js)
When you have Node.js installed on your machine:
```bash
cd 
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Vite hot-reloading app.

---

## 🔌 Where to Connect Your Backend

All backend communication and data sending logic is isolated in:
👉 `src/services/backendApi.js`

### 1. Configure Endpoint URL & Auth
You can configure the endpoint either in `src/services/backendApi.js` or directly inside the UI via the **"⚙️ Backend Settings"** drawer:
```javascript
export const DEFAULT_BACKEND_URL = 'http://localhost:8000/api/solve-sudoku';
```

### 2. Outgoing Request Payload (What is sent to your backend)
When the user clicks **"Solve with LLM"**, the frontend sends an HTTP `POST` request to your endpoint with `Content-Type: application/json`.

You can choose one of 4 supported formats depending on what your LLM accepts:

#### Format A: 2D Matrix (`GRID_2D` - Default)
```json
{
  "sudoku_board": [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    ...
  ],
  "format": "GRID_2D",
  "model_params": {
    "temperature": 0.1,
    "task": "solve_sudoku"
  },
  "timestamp": "2026-11-20T22:50:00.000Z"
}
```

#### Format B: 81-Character String (`STRING_81`)
```json
{
  "sudoku_board": "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  "format": "STRING_81"
}
```

#### Format C: List of Known Clues (`COORDINATES`)
```json
{
  "sudoku_board": [
    { "row": 0, "col": 0, "value": 5 },
    { "row": 0, "col": 1, "value": 3 },
    { "row": 0, "col": 4, "value": 7 }
  ],
  "format": "COORDINATES"
}
```

#### Format D: Direct Prompt Text (`PROMPT_TEXT`)
```json
{
  "sudoku_board": "5 3 . . 7 . . . .\n6 . . 1 9 5 . . .\n. 9 8 . . . . 6 .\n...",
  "format": "PROMPT_TEXT"
}
```

### 3. Expected Response from Your Backend
Your backend can return the solution in any of the following standard structures (handled automatically by `parseBackendResponse()` in `backendApi.js`):

**Option A (Recommended):**
```json
{
  "solution": [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    ...
  ]
}
```

**Option B (81-character string):**
```json
{
  "solution": "534678912672195348198342567859761423426853791713924856961537284287419635345286179"
}
```

---

## 🎨 UI Features

1. **Table Format**:
   - Clean 9x9 HTML table layout with bold 3x3 block borders.
   - Smooth keyboard input: 1–9 to fill cells, 0 / Backspace / Delete to clear.
   - Arrow keys (`↑`, `↓`, `←`, `→`) to navigate across cells seamlessly.
   - Touch/Mouse Quick Number Pad for mobile or mouse-driven input.
2. **Visual Hierarchy**:
   - **Known Clues**: Rendered in bold, white text on dark background.
   - **LLM Solutions**: Highlighted in bright cyan with a subtle `LLM` badge and entry animation.
   - **Conflicts**: Instantly flagged in red if duplicate numbers appear in the same row, column, or 3x3 box.
3. **Control Bar**:
   - **Solve with LLM**: Disabled if conflicts exist or no clues are entered.
   - **Reset to Clues**: Keeps only your original entered numbers and clears LLM solutions.
   - **Clear Board**: Wipes the board clean.
   - **Presets**: Instant "Easy", "Medium", and "Hard (AI Challenge)" puzzles for testing.
4. **Backend Settings Drawer**:
   - Change API endpoint URL on the fly.
   - Add Authorization/Bearer tokens if needed.
   - Switch payload formats.
   - Toggle **Local Mock Simulation** for offline testing before your backend is deployed.
   - Live **"Preview Outgoing JSON Payload"** button showing the exact JSON that will be sent.
5. **Status & Metrics**:
   - Real-time clue counter (`X / 81`).
   - Real-time conflict tracker.
   - LLM latency measurement (in milliseconds).
   - Collapsible raw backend JSON response inspector.

---

## 📁 File Structure

```
sudoku-llm-frontend/
├── index.html                   # Vite HTML entry
├── standalone.html              # Standalone single-file React app (zero install)
├── package.json                 # Dependencies & scripts
├── vite.config.js               # Vite bundler configuration
├── README.md                    # Integration & usage guide
└── src/
    ├── App.jsx                  # Main application state and layout
    ├── index.css                # Custom styles, borders & animations
    ├── main.jsx                 # React root renderer
    ├── components/
    │   ├── SudokuTable.jsx      # 9x9 Table component with subgrids & keyboard nav
    │   ├── ControlBar.jsx       # Solve, Clear, Reset, and Preset controls
    │   ├── BackendConfig.jsx    # Backend endpoint, auth & payload preview
    │   └── StatusCard.jsx       # Latency, conflict count, & response inspector
    ├── services/
    │   └── backendApi.js        # ⭐️ PLACE TO SEND DATA/VALUES TO YOUR BACKEND
    └── utils/
        ├── presets.js           # Sample puzzles for quick testing
        └── sudokuValidator.js   # Conflict checking and grid utilities
```
