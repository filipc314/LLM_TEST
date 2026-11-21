"""Build the fixed benchmark corpus from a seed and verify uniqueness."""

import json
import random
from pathlib import Path

from solver import _next_cell, solve_board_with_stats


SEED = 2953
PER_DIFFICULTY = 10
LEVELS = {
    "easy": (38, 44, 0, 0),
    "medium": (29, 34, 4, 24),
    "hard": (24, 29, 36, 160),
}


def count_solutions(board, limit=2, rng=None):
    """Count up to the limit. A randomized search keeps the first complete grid."""
    cell = _next_cell(board)
    if cell is None:
        return 1
    row, col, candidates = cell
    digits = sorted(candidates)
    if rng is not None:
        rng.shuffle(digits)

    count = 0
    for digit in digits:
        board[row][col] = digit
        count += count_solutions(board, limit - count, rng)
        if count >= limit:
            if rng is None:
                board[row][col] = 0
            return count
        board[row][col] = 0
    return count


def make_puzzle(rng, clues):
    board = [[0] * 9 for _ in range(9)]
    count_solutions(board, limit=1, rng=rng)
    positions = list(range(81))
    rng.shuffle(positions)
    remaining = 81
    for position in positions:
        row, col = divmod(position, 9)
        digit = board[row][col]
        board[row][col] = 0
        if count_solutions(board) == 1:
            remaining -= 1
            if remaining == clues:
                return board
        else:
            board[row][col] = digit
    return None


def main():
    rng = random.Random(SEED)
    puzzles = []
    for level, (min_clues, max_clues, min_undo, max_undo) in LEVELS.items():
        index = 0
        while index < PER_DIFFICULTY:
            board = make_puzzle(rng, rng.randint(min_clues, max_clues))
            if board is None:
                continue
            _, stats = solve_board_with_stats(board)
            if min_undo <= stats.backtracks <= max_undo:
                index += 1
                puzzles.append({"id": f"{level}-{index:02d}", "difficulty": level, "board": board})
                print(f"{level}-{index:02d}: {stats.backtracks} baseline backtracks", flush=True)
    path = Path(__file__).resolve().parent.parent / "benchmark" / "puzzles.json"
    path.parent.mkdir(exist_ok=True)
    entries = []
    for puzzle in puzzles:
        # Keep each 9×9 matrix readable as nine lines.
        grid = ",\n".join("        " + json.dumps(row) for row in puzzle["board"])
        entries.append(
            f'    {{\n      "id": "{puzzle["id"]}", "difficulty": "{puzzle["difficulty"]}",'
            f'\n      "board": [\n{grid}\n      ]\n    }}'
        )
    path.write_text(f'{{\n  "seed": {SEED},\n  "puzzles": [\n' +
                    ",\n".join(entries) + "\n  ]\n}\n")


if __name__ == "__main__":
    main()
