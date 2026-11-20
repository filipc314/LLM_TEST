import React, { useState, useMemo } from 'react';
import SudokuTable from './components/SudokuTable';
import ControlBar from './components/ControlBar';
import BackendConfig from './components/BackendConfig';
import StatusCard from './components/StatusCard';
import {
  solveSudokuWithLLM,
  DEFAULT_BACKEND_URL,
  PayloadFormat
} from './services/backendApi';
import {
  createEmptyBoard,
  findBoardConflicts,
  countClues
} from './utils/sudokuValidator';
import { PRESETS } from './utils/presets';

export default function App() {
  // 9x9 active board state
  const [board, setBoard] = useState(() => PRESETS[0].board.map(r => [...r]));
  
  // Tracks which cells were original known user clues vs LLM solved numbers
  const [initialClues, setInitialClues] = useState(() => PRESETS[0].board.map(r => [...r]));
  
  // Focused cell for keyboard & numpad navigation
  const [focusedCell, setFocusedCell] = useState({ r: 0, c: 0 });
  
  // Solving lifecycle & status states
  const [isSolving, setIsSolving] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'solving' | 'success' | 'error'
  const [error, setError] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);
  const [hasSolution, setHasSolution] = useState(false);

  // Backend connection settings
  const [backendConfig, setBackendConfig] = useState({
    endpoint: DEFAULT_BACKEND_URL,
    apiKey: '',
    payloadFormat: PayloadFormat.GRID_2D,
    useMock: true // Defaults to true so frontend is immediately testable before backend is up
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Calculate real-time conflicts
  const conflicts = useMemo(() => findBoardConflicts(board), [board]);
  const cluesCount = useMemo(() => countClues(board), [board]);
  const hasConflicts = conflicts.size > 0;

  // Handle cell value changes
  const handleCellChange = (r, c, val) => {
    const newBoard = board.map(row => [...row]);
    const newClues = initialClues.map(row => [...row]);

    newBoard[r][c] = val;
    newClues[r][c] = val; // Entering a value marks it as an initial known clue

    setBoard(newBoard);
    setInitialClues(newClues);
    setError(null);
    if (status !== 'idle') setStatus('idle');
  };

  // Quick numpad selection for focused cell
  const handleSelectNumber = (num) => {
    if (!focusedCell) return;
    handleCellChange(focusedCell.r, focusedCell.c, num);
  };

  // Solve board using LLM
  const handleSolve = async () => {
    if (hasConflicts) {
      setError('Please resolve conflicting numbers highlighted in red before submitting.');
      return;
    }
    if (cluesCount === 0) {
      setError('Please enter at least one known clue before solving.');
      return;
    }

    setIsSolving(true);
    setStatus('solving');
    setError(null);
    setRawResponse(null);

    // Snapshot the current known numbers as initial clues before solving
    const lockedClues = board.map(r => [...r]);
    setInitialClues(lockedClues);

    try {
      const result = await solveSudokuWithLLM(board, backendConfig);
      setBoard(result.solution);
      setLatencyMs(result.latencyMs);
      setRawResponse(result.rawResponse);
      setStatus('success');
      setHasSolution(true);
    } catch (err) {
      setError(err.message || 'An unknown error occurred while contacting the LLM backend.');
      setStatus('error');
    } finally {
      setIsSolving(false);
    }
  };

  // Clear all cells
  const handleClear = () => {
    const empty = createEmptyBoard();
    setBoard(empty);
    setInitialClues(empty);
    setStatus('idle');
    setError(null);
    setLatencyMs(null);
    setRawResponse(null);
    setHasSolution(false);
  };

  // Reset back to initial known clues (clearing LLM filled cells)
  const handleResetToClues = () => {
    setBoard(initialClues.map(r => [...r]));
    setStatus('idle');
    setError(null);
    setHasSolution(false);
  };

  // Load a preset puzzle
  const handleLoadPreset = (presetBoard) => {
    const cloned = presetBoard.map(r => [...r]);
    setBoard(cloned);
    setInitialClues(cloned.map(r => [...r]));
    setStatus('idle');
    setError(null);
    setLatencyMs(null);
    setRawResponse(null);
    setHasSolution(false);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-badge">
            <span className="logo-icon">🧩</span>
            <div>
              <h1 className="logo-title">LLM Sudoku Resolver</h1>
              <p className="logo-subtitle">Frontend interface for LLM-powered Sudoku solver models</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-secondary-sm"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
            >
              ⚙️ Backend Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="main-content">
        {/* Backend & API Configuration Drawer */}
        <BackendConfig
          config={backendConfig}
          onChangeConfig={setBackendConfig}
          currentBoard={board}
          isOpen={isConfigOpen}
          onToggle={() => setIsConfigOpen(!isConfigOpen)}
        />

        <div className="sudoku-workspace">
          {/* Left Column: Sudoku Table */}
          <section className="grid-section">
            <div className="grid-card">
              <div className="grid-card-header">
                <div className="grid-title">
                  <h2>Sudoku Board</h2>
                  <span className="grid-hint">
                    Click any cell and type 1–9. Arrow keys navigate.
                  </span>
                </div>
                <div className="legend">
                  <span className="legend-item">
                    <span className="legend-chip legend-chip-clue"></span> Known Clue
                  </span>
                  <span className="legend-item">
                    <span className="legend-chip legend-chip-llm"></span> Solved by LLM
                  </span>
                  <span className="legend-item">
                    <span className="legend-chip legend-chip-conflict"></span> Conflict
                  </span>
                </div>
              </div>

              {/* The Sudoku Table */}
              <SudokuTable
                board={board}
                initialClues={initialClues}
                conflicts={conflicts}
                isSolving={isSolving}
                onCellChange={handleCellChange}
                focusedCell={focusedCell}
                setFocusedCell={setFocusedCell}
              />
            </div>
          </section>

          {/* Right Column: Controls, Status & Integration */}
          <section className="sidebar-section">
            {/* Status & Stats */}
            <StatusCard
              status={status}
              error={error}
              latencyMs={latencyMs}
              cluesCount={cluesCount}
              conflictsCount={conflicts.size}
              rawResponse={rawResponse}
              isSolving={isSolving}
            />

            {/* Action Buttons & Presets */}
            <div className="card-panel">
              <ControlBar
                onSolve={handleSolve}
                onClear={handleClear}
                onResetToClues={handleResetToClues}
                onLoadPreset={handleLoadPreset}
                isSolving={isSolving}
                hasConflicts={hasConflicts}
                hasClues={cluesCount > 0}
                hasSolution={hasSolution}
                selectedNumber={board[focusedCell?.r || 0]?.[focusedCell?.c || 0] || 0}
                onSelectNumber={handleSelectNumber}
              />
            </div>

            {/* Developer Backend Notes */}
            <div className="card-panel developer-notes">
              <h3 className="notes-title">
                <span>🔌</span> Backend Integration Note
              </h3>
              <p className="notes-text">
                This frontend sends the table state to your custom LLM backend.
                Look at <code>src/services/backendApi.js</code> to adjust endpoints, headers,
                or request payload shapes. Toggle <em>Mock Mode</em> in settings to test offline.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Built with React for custom LLM Sudoku models</p>
      </footer>
    </div>
  );
}
