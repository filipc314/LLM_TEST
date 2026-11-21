import React from 'react';
import { PRESETS } from '../utils/presets';
import { SOLVER_MODES } from '../services/backendApi';

export default function ControlBar({
  onSolve,
  onCompare,
  mode,
  onChangeMode,
  onClear,
  onResetToClues,
  onLoadPreset,
  isSolving,
  hasConflicts,
  hasClues,
  hasSolution,
  useMock,
  onSelectNumber
}) {
  return (
    <div className="control-bar-wrapper">
      <div className="form-group">
        <label htmlFor="solver-mode" className="form-label">Solving method</label>
        <select id="solver-mode" className="form-select" value={mode}
          disabled={isSolving || useMock} onChange={(event) => onChangeMode(event.target.value)}>
          {SOLVER_MODES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {/* Primary Actions */}
      <div className="action-buttons-group">
        <button
          className={`btn btn-primary ${isSolving ? 'btn-loading' : ''}`}
          onClick={onSolve}
          disabled={isSolving || hasConflicts || !hasClues}
          title={
            hasConflicts
              ? 'Resolve red duplicate conflicts before solving'
              : !hasClues
              ? 'Enter at least one known number'
              : useMock
              ? 'Solve the board locally'
              : 'Send clues to the backend'
          }
        >
          {isSolving ? (
            <>
              <span className="spinner"></span>
              {useMock ? 'Solving locally...' : 'Waiting for backend...'}
            </>
          ) : (
            <>
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {useMock ? 'Solve Locally (Mock)' : 'Solve'}
            </>
          )}
        </button>

        {!useMock && (
          <button className="btn btn-secondary" onClick={onCompare}
            disabled={isSolving || hasConflicts || !hasClues}>
            Compare all methods
          </button>
        )}

        {hasSolution && (
          <button
            className="btn btn-secondary"
            onClick={onResetToClues}
            disabled={isSolving}
            title="Keep only the numbers you initially entered"
          >
            Reset to Clues
          </button>
        )}

        <button
          className="btn btn-outline"
          onClick={onClear}
          disabled={isSolving}
          title="Clear all numbers from the grid"
        >
          Clear Board
        </button>
      </div>

      {/* Preset Puzzles */}
      <div className="presets-group">
        <span className="presets-label">Load Preset:</span>
        <div className="presets-buttons">
          {PRESETS.map((preset, index) => (
            <button
              key={preset.name}
              className="btn btn-chip"
              disabled={isSolving}
              onClick={() => onLoadPreset(preset.board)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Onscreen Number Pad (Convenient for mouse and tablet users) */}
      <div className="numpad-container">
        <span className="numpad-label">Quick Input Pad:</span>
        <div className="numpad-keys">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              className="numpad-key"
              disabled={isSolving}
              onClick={() => onSelectNumber(num)}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="numpad-key numpad-erase"
            disabled={isSolving}
            onClick={() => onSelectNumber(0)}
            title="Erase cell"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
