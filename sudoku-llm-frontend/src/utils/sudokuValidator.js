/**
 * Sudoku validation and grid manipulation helpers
 */

/**
 * Creates an empty 9x9 board filled with 0s.
 */
export function createEmptyBoard() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

/**
 * Validates the entire board and returns a Set of conflicting cell coordinates
 * in format "row,col" so the table can highlight them in red.
 */
export function findBoardConflicts(board) {
  const conflicts = new Set();

  // Check rows
  for (let r = 0; r < 9; r++) {
    const seen = new Map();
    for (let c = 0; c < 9; c++) {
      const val = board[r][c];
      if (val && val !== 0) {
        if (seen.has(val)) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${r},${seen.get(val)}`);
        } else {
          seen.set(val, c);
        }
      }
    }
  }

  // Check columns
  for (let c = 0; c < 9; c++) {
    const seen = new Map();
    for (let r = 0; r < 9; r++) {
      const val = board[r][c];
      if (val && val !== 0) {
        if (seen.has(val)) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${seen.get(val)},${c}`);
        } else {
          seen.set(val, r);
        }
      }
    }
  }

  // Check 3x3 subgrids
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Map();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const row = boxRow * 3 + r;
          const col = boxCol * 3 + c;
          const val = board[row][col];
          if (val && val !== 0) {
            if (seen.has(val)) {
              conflicts.add(`${row},${col}`);
              conflicts.add(seen.get(val));
            } else {
              seen.set(val, `${row},${col}`);
            }
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Counts the number of filled known clues on the board.
 */
export function countClues(board) {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] && board[r][c] !== 0) count++;
    }
  }
  return count;
}
