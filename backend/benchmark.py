import argparse
import json
import platform
from dataclasses import asdict
from pathlib import Path
from statistics import median
from time import perf_counter

from model import MODEL_IDS, MODEL_REVISIONS, load_model
from solver import solve_board_with_stats, validate_board


BENCHMARK_DIR = Path(__file__).resolve().parent.parent / "benchmark"
METHODS = ("classic", *MODEL_IDS)


def valid_solution(solution, clues):
    return (
        solution is not None
        and all(all(row) for row in solution)
        and validate_board(solution) is None
        and all(
            original == 0 or original == solved
            for clue_row, solution_row in zip(clues, solution)
            for original, solved in zip(clue_row, solution_row)
        )
    )


def summarize(rows):
    return {
        "correct": sum(row["correct"] for row in rows),
        "boards": len(rows),
        "total_ms": sum(row["elapsed_ms"] for row in rows),
        "median_ms": median(row["elapsed_ms"] for row in rows),
        **{
            field: sum(row[field] for row in rows)
            for field in ("attempts", "backtracks", "model_calls",
                          "invalid_model_responses", "model_errors")
        },
    }


def run(args):
    puzzles = json.loads(args.puzzles.read_text())["puzzles"]
    if args.difficulty:
        puzzles = [puzzle for puzzle in puzzles if puzzle["difficulty"] == args.difficulty]
    if args.limit:
        puzzles = puzzles[:args.limit]
    if not puzzles:
        raise ValueError("The benchmark needs at least one puzzle.")
    for puzzle in puzzles:
        if validate_board(puzzle["board"]):
            raise ValueError(f"Invalid benchmark board: {puzzle['id']}")

    environment = {"python": platform.python_version(), "platform": platform.platform()}
    if any(method in MODEL_IDS for method in args.methods):
        import torch
        import transformers

        environment.update(torch=torch.__version__, transformers=transformers.__version__)

    report = {
        "environment": environment,
        "settings": {"device": args.device, "methods": args.methods,
                     "puzzles": args.puzzles.name, "board_count": len(puzzles)},
        "models": {},
        "runs": [],
        "summary": {},
    }

    for method in args.methods:
        model = None
        if method in MODEL_IDS:
            started_at = perf_counter()
            model = load_model(method, args.device)
            load_ms = (perf_counter() - started_at) * 1000
            parameters = list(model.model.parameters())
            report["models"][method] = {
                "repository": MODEL_IDS[method],
                "revision": MODEL_REVISIONS[method],
                "device": model.device,
                "dtype": str(model.model.dtype),
                "parameters": sum(p.numel() for p in parameters),
                "parameter_bytes": sum(p.numel() * p.element_size() for p in parameters),
                "load_ms": load_ms,
            }
            warmup = [[0] * 9 for _ in range(9)]
            warmup[0][0] = 1
            model(warmup, 0, 1, tuple(range(2, 10)))
            print(f"{method} loaded in {load_ms:.0f} ms on {model.device}", flush=True)

        rows = []
        for index, puzzle in enumerate(puzzles, start=1):
            board = puzzle["board"]
            solution, stats = solve_board_with_stats(board, model)
            row = {
                "method": method,
                "puzzle": puzzle["id"],
                "difficulty": puzzle["difficulty"],
                "clues": sum(value != 0 for line in board for value in line),
                "correct": valid_solution(solution, board),
                **asdict(stats),
            }
            rows.append(row)
            print(f"{method} {index}/{len(puzzles)} {puzzle['id']}: "
                  f"{row['elapsed_ms']:.0f} ms, {row['model_calls']} model calls", flush=True)

        report["runs"].extend(rows)
        report["summary"][method] = summarize(rows)
        args.output.write_text(json.dumps(report, indent=2) + "\n")
    return 0 if all(row["correct"] and not row["model_errors"] for row in report["runs"]) else 1


def main():
    parser = argparse.ArgumentParser(description="Compare Sudoku solvers on the same puzzles.")
    parser.add_argument("--puzzles", type=Path, default=BENCHMARK_DIR / "puzzles.json")
    parser.add_argument("--output", type=Path, default=BENCHMARK_DIR / "results.json")
    parser.add_argument("--device", choices=("auto", "mps", "cpu"), default="auto")
    parser.add_argument("--methods", nargs="+", choices=METHODS, default=list(METHODS))
    parser.add_argument("--difficulty", choices=("easy", "medium", "hard"))
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive.")
    if len(args.methods) != len(set(args.methods)):
        parser.error("List each method at most once.")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
