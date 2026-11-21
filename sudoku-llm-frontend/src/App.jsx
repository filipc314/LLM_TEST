import React, { useState, useMemo } from 'react';
import SudokuTable from './components/SudokuTable';
import ControlBar from './components/ControlBar';
import BackendConfig from './components/BackendConfig';
import StatusCard from './components/StatusCard';
import {
  solveSudokuWithLLM,
  DEFAULT_BACKEND_URL,
  SOLVER_MODES
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
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState({});

  // Backend connection settings
  const [backendConfig, setBackendConfig] = useState({
    endpoint: DEFAULT_BACKEND_URL,
    apiKey: '',
    mode: 'classic',
    useMock: false
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Calculate real-time conflicts
  const conflicts = useMemo(() => findBoardConflicts(board), [board]);
  const cluesCount = useMemo(() => countClues(initialClues), [initialClues]);
  const hasConflicts = conflicts.size > 0;

  // Handle cell value changes
  const handleCellChange = (r, c, val) => {
    if (board[r][c] === val && initialClues[r][c] === val) return;
    const newClues = initialClues.map(row => [...row]);
    newClues[r][c] = val;
    setBoard(newClues);
    setInitialClues(newClues);
    setResult(null);
    setComparison({});
    setError(null);
    if (status !== 'idle') setStatus('idle');
  };

  // Quick numpad selection for focused cell
  const handleSelectNumber = (num) => {
    if (!focusedCell) return;
    handleCellChange(focusedCell.r, focusedCell.c, num);
  };

  const handleSolve = async (compare = false) => {
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
    if (compare) setComparison({});

    const modes = compare ? SOLVER_MODES.map(({ id }) => id) : [backendConfig.mode];
    let displayedResult = null;
    const errors = [];
    try {
      for (const mode of modes) {
        try {
          const nextResult = await solveSudokuWithLLM(initialClues, { ...backendConfig, mode });
          if (!displayedResult || mode === backendConfig.mode) displayedResult = nextResult;
          if (nextResult.stats) {
            setComparison(previous => ({ ...previous, [mode]: { stats: nextResult.stats } }));
          }
        } catch (err) {
          const label = SOLVER_MODES.find(({ id }) => id === mode)?.label;
          errors.push(compare ? `${label}: ${err.message}` : err.message);
          if (!backendConfig.useMock) {
            setComparison(previous => ({ ...previous, [mode]: { error: err.message, stats: err.stats } }));
          }
        }
      }
      if (displayedResult) {
        setBoard(displayedResult.solution);
        setResult(displayedResult);
      }
      setError(errors.length ? errors.join(' · ') : null);
      setStatus(displayedResult ? 'success' : 'error');
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
    setResult(null);
    setComparison({});
  };

  // Reset back to initial known clues (clearing LLM filled cells)
  const handleResetToClues = () => {
    setBoard(initialClues.map(r => [...r]));
    setStatus('idle');
    setError(null);
    setResult(null);
    setComparison({});
  };

  // Load a preset puzzle
  const handleLoadPreset = (presetBoard) => {
    const cloned = presetBoard.map(r => [...r]);
    setBoard(cloned);
    setInitialClues(cloned.map(r => [...r]));
    setStatus('idle');
    setError(null);
    setResult(null);
    setComparison({});
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
          currentBoard={initialClues}
          isSolving={isSolving}
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
                    <span className="legend-chip legend-chip-llm"></span> Filled by Solver
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
                fromMock={result?.fromMock}
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
              result={status === 'success' ? result : null}
              comparison={comparison}
              cluesCount={cluesCount}
              conflictsCount={conflicts.size}
              isSolving={isSolving}
              useMock={backendConfig.useMock}
            />

            {/* Action Buttons & Presets */}
            <div className="card-panel">
              <ControlBar
                onSolve={() => handleSolve()}
                onCompare={() => handleSolve(true)}
                mode={backendConfig.mode}
                onChangeMode={(mode) => setBackendConfig(previous => ({ ...previous, mode }))}
                onClear={handleClear}
                onResetToClues={handleResetToClues}
                onLoadPreset={handleLoadPreset}
                isSolving={isSolving}
                hasConflicts={hasConflicts}
                hasClues={cluesCount > 0}
                hasSolution={result !== null}
                useMock={backendConfig.useMock}
                onSelectNumber={handleSelectNumber}
              />
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
