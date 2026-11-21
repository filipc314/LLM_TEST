import React, { useRef, useEffect } from 'react';

/**
 * SudokuTable Component
 * 
 * Renders an accessible 9x9 HTML table with 3x3 block visual separation.
 * Supports:
 * - Direct keyboard input (1-9 to input, Backspace/Delete/0 to clear)
 * - Arrow key navigation (Up/Down/Left/Right)
 * - Visual distinction between known clues and solver output
 * - Real-time conflict/duplicate highlighting
 */
export default function SudokuTable({
  board,
  initialClues,
  conflicts,
  fromMock,
  isSolving,
  onCellChange,
  focusedCell,
  setFocusedCell
}) {
  const tableRef = useRef(null);
  const solverLabel = fromMock ? 'Mock' : 'Solved';

  // Focus the input when focusedCell changes programmatically
  useEffect(() => {
    if (focusedCell) {
      const inputEl = document.getElementById(`cell-${focusedCell.r}-${focusedCell.c}`);
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }
  }, [focusedCell]);

  const handleKeyDown = (e, r, c) => {
    if (isSolving) return;

    // Arrow navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedCell({ r: Math.max(0, r - 1), c });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedCell({ r: Math.min(8, r + 1), c });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedCell({ r, c: Math.max(0, c - 1) });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedCell({ r, c: Math.min(8, c + 1) });
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      onCellChange(r, c, 0);
    } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
      e.preventDefault();
      onCellChange(r, c, Number(e.key));
      // Auto-advance to next cell on number entry for fast puzzle typing
      if (c < 8) {
        setFocusedCell({ r, c: c + 1 });
      } else if (r < 8) {
        setFocusedCell({ r: r + 1, c: 0 });
      }
    }
  };

  const handleInputChange = (e, r, c) => {
    const val = e.target.value.replace(/[^1-9]/g, '');
    const num = val.length > 0 ? Number(val.slice(-1)) : 0;
    onCellChange(r, c, num);
  };

  return (
    <div className="sudoku-table-container">
      <table className="sudoku-table" ref={tableRef} role="grid" aria-label="Sudoku Grid">
        <tbody>
          {board.map((row, r) => (
            <tr key={`row-${r}`} className={`sudoku-row ${r % 3 === 2 && r !== 8 ? 'subgrid-bottom-border' : ''}`}>
              {row.map((val, c) => {
                const isInitialClue = initialClues[r][c] !== 0;
                const isSolverFill = !isInitialClue && val !== 0;
                const hasConflict = conflicts.has(`${r},${c}`);
                const isFocused = focusedCell?.r === r && focusedCell?.c === c;

                const borderClasses = [
                  c % 3 === 2 && c !== 8 ? 'subgrid-right-border' : '',
                  r % 3 === 2 && r !== 8 ? 'subgrid-bottom-border' : ''
                ].filter(Boolean).join(' ');

                const cellStateClass = hasConflict
                  ? 'cell-conflict'
                  : isSolverFill
                  ? 'cell-solved-llm'
                  : isInitialClue
                  ? 'cell-initial-clue'
                  : 'cell-empty';

                return (
                  <td
                    key={`col-${c}`}
                    className={`sudoku-cell ${borderClasses} ${cellStateClass} ${isFocused ? 'cell-focused' : ''}`}
                    onClick={() => setFocusedCell({ r, c })}
                  >
                    <input
                      id={`cell-${r}-${c}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[1-9]*"
                      maxLength={1}
                      disabled={isSolving}
                      value={val === 0 || val === null ? '' : val}
                      onKeyDown={(e) => handleKeyDown(e, r, c)}
                      onChange={(e) => handleInputChange(e, r, c)}
                      onFocus={() => setFocusedCell({ r, c })}
                      className="cell-input"
                      aria-label={`Row ${r + 1}, Column ${c + 1}`}
                      autoComplete="off"
                    />
                    {isSolverFill && (
                      <span className="llm-pill">
                        {solverLabel}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
