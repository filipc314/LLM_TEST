from dataclasses import dataclass
from time import perf_counter


DIGITS = frozenset(range(1, 10))


@dataclass
class SolveStats:
    attempts: int = 0
    backtracks: int = 0
    elapsed_ms: float = 0.0
    model_calls: int = 0
    invalid_model_responses: int = 0
    model_errors: int = 0


def _column(board, col):
    return (row[col] for row in board)


def _box(board, row, col):
    top = row - row % 3
    left = col - col % 3
    return (board[r][c] for r in range(top, top + 3) for c in range(left, left + 3))


def _is_cell_value(value):
    return type(value) in (int, float) and 0 <= value <= 9 and value == int(value)


def validate_board(board):
    if not isinstance(board, list) or len(board) != 9 or not all(
        isinstance(row, list)
        and len(row) == 9
        and all(_is_cell_value(value) for value in row)
        for row in board
    ):
        return "sudoku_board must be a 9×9 grid of integers from 0 to 9."
    if not any(any(row) for row in board):
        return "Enter at least one clue before solving."

    units = [
        *board,
        *(_column(board, col) for col in range(9)),
        *(_box(board, row, col) for row in range(0, 9, 3) for col in range(0, 9, 3)),
    ]
    for unit in units:
        clues = [value for value in unit if value]
        if len(clues) != len(set(clues)):
            return "The board contains duplicate clues in a row, column, or 3×3 box."
    return None


def _next_cell(board):
    selected = None
    for row in range(9):
        for col in range(9):
            if board[row][col]:
                continue
            used = set(board[row]).union(_column(board, col), _box(board, row, col))
            candidates = DIGITS - used
            if not candidates:
                return row, col, candidates
            if selected is None or len(candidates) < len(selected[2]):
                selected = row, col, candidates
    return selected


def _fill(board, stats, choose_digit):
    cell = _next_cell(board)
    if cell is None:
        return True

    row, col, candidates = cell
    ordered = sorted(candidates)
    if choose_digit is not None and len(ordered) > 1:
        stats.model_calls += 1
        try:
            suggested = choose_digit(board, row, col, tuple(ordered))
        except (RuntimeError, OSError):
            stats.model_errors += 1
        else:
            if type(suggested) is int and suggested in candidates:
                ordered.remove(suggested)
                ordered.insert(0, suggested)
            else:
                stats.invalid_model_responses += 1

    for digit in ordered:
        stats.attempts += 1
        board[row][col] = digit
        if _fill(board, stats, choose_digit):
            return True
        board[row][col] = 0
        stats.backtracks += 1
    return False


def solve_board(clues):
    solution, _ = solve_board_with_stats(clues)
    return solution


def solve_board_with_stats(clues, choose_digit=None):
    stats = SolveStats()
    started_at = perf_counter()
    board = [[int(value) for value in row] for row in clues]
    solution = board if _fill(board, stats, choose_digit) else None
    stats.elapsed_ms = (perf_counter() - started_at) * 1000
    return solution, stats
