import json
import unittest
from io import BytesIO
from unittest.mock import patch

from benchmark import BENCHMARK_DIR, valid_solution
from model import ModelUnavailable, build_messages, parse_choice
from server import application
from solver import solve_board_with_stats


PUZZLES = {
    puzzle["id"]: puzzle["board"]
    for puzzle in json.loads((BENCHMARK_DIR / "puzzles.json").read_text())["puzzles"]
}


def post(**fields):
    data = json.dumps({"format": "GRID_2D", "sudoku_board": PUZZLES["medium-01"], **fields}).encode()
    statuses = []
    body = application(
        {"REQUEST_METHOD": "POST", "PATH_INFO": "/api/solve-sudoku",
         "CONTENT_LENGTH": str(len(data)), "wsgi.input": BytesIO(data)},
        lambda status, headers: statuses.append(int(status.split()[0])),
    )
    return statuses[0], json.loads(b"".join(body))


class SolverTests(unittest.TestCase):
    def test_advice_changes_search_but_keeps_solution_valid(self):
        board = PUZZLES["medium-01"]
        baseline, classic = solve_board_with_stats(board)

        def choose_last(grid, row, col, digits):
            self.assertEqual(grid[row][col], 0)
            self.assertGreater(len(digits), 1)
            return digits[-1]

        solution, hybrid = solve_board_with_stats(board, choose_last)
        self.assertEqual(solution, baseline)
        self.assertTrue(valid_solution(solution, board))
        self.assertGreater(hybrid.model_calls, 0)
        self.assertNotEqual(hybrid.backtracks, classic.backtracks)
        self.assertEqual(hybrid.invalid_model_responses, 0)

    def test_forced_moves_skip_the_model(self):
        def unexpected_call(*args):
            self.fail("The model was called on a forced move")

        board = PUZZLES["easy-01"]
        solution, stats = solve_board_with_stats(board, unexpected_call)
        self.assertTrue(valid_solution(solution, board))
        self.assertEqual(stats.model_calls, 0)

    def test_invalid_digits_keep_classic_candidate_order(self):
        board = PUZZLES["medium-01"]
        expected, classic = solve_board_with_stats(board)
        result, hybrid = solve_board_with_stats(board, lambda *_: 0)
        self.assertEqual(result, expected)
        self.assertEqual(hybrid.attempts, classic.attempts)
        self.assertEqual(hybrid.backtracks, classic.backtracks)
        self.assertGreater(hybrid.model_calls, 0)
        self.assertEqual(hybrid.invalid_model_responses, hybrid.model_calls)

    def test_prompt_and_reply_validation(self):
        messages = build_messages(PUZZLES["medium-01"], 2, 4, (3, 7))
        self.assertIn("row 3, column 5. Candidates: 3, 7.", messages[1]["content"])
        self.assertEqual(parse_choice(" 7\n", (3, 7)), 7)
        for reply in ("9", "37", "7.", "The answer is 7", ""):
            self.assertIsNone(parse_choice(reply, (3, 7)))


class ApiTests(unittest.TestCase):
    def test_classic_default_and_grid_format(self):
        status, payload = post()
        self.assertEqual(status, 200)
        self.assertEqual(payload["method"], "classic")
        self.assertIsNone(payload["model"])
        self.assertTrue(valid_solution(payload["solution"], PUZZLES["medium-01"]))
        self.assertEqual(payload["stats"]["model_calls"], 0)
        self.assertEqual(post(format="OTHER")[1]["code"], "UNSUPPORTED_FORMAT")
        self.assertEqual(post(method="unknown")[1]["code"], "INVALID_METHOD")
        self.assertEqual(post(method="hybrid", model=[])[1]["code"], "INVALID_MODEL")
        self.assertEqual(post(sudoku_board=[])[1]["code"], "INVALID_BOARD")

    @patch("server.load_model")
    def test_selected_model_and_unavailable_error(self, load_model):
        load_model.return_value = lambda *_: 0
        status, payload = post(method="hybrid", model="smollm2-135m")
        self.assertEqual(status, 200)
        load_model.assert_called_once_with("smollm2-135m")
        self.assertEqual(payload["model"], "smollm2-135m")
        self.assertGreater(payload["stats"]["invalid_model_responses"], 0)
        load_model.side_effect = ModelUnavailable("Offline cache is missing")
        status, payload = post(method="hybrid", model="smollm2-360m")
        self.assertEqual(status, 503)
        self.assertEqual(payload["code"], "MODEL_UNAVAILABLE")

    @patch("server.load_model")
    def test_generation_failure_uses_classic_order(self, load_model):
        def fail(*args):
            raise RuntimeError("Inference failed")

        load_model.return_value = fail
        status, payload = post(method="hybrid", model="smollm2-135m")
        self.assertEqual(status, 200)
        self.assertEqual(payload["stats"]["model_errors"], payload["stats"]["model_calls"])
        self.assertGreater(payload["stats"]["model_errors"], 0)


if __name__ == "__main__":
    unittest.main()
