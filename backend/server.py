import json
from dataclasses import asdict
from http import HTTPStatus
from wsgiref.simple_server import make_server

from model import MODEL_IDS, ModelUnavailable, load_model
from solver import solve_board_with_stats, validate_board


HOST = "127.0.0.1"
PORT = 8000
SOLVE_PATH = "/api/solve-sudoku"
MAX_BODY_BYTES = 8 * 1024
FRONTEND_ORIGINS = {"http://localhost:3000", "http://127.0.0.1:3000"}


def _error(status, code, message):
    return status, {"code": code, "message": message}


def _reject_json_constant(value):
    raise ValueError(f"Invalid JSON constant: {value}")


def _solve_request(environ):
    try:
        size = int(environ.get("CONTENT_LENGTH") or "0")
        if size < 0:
            raise ValueError
    except ValueError:
        return _error(HTTPStatus.BAD_REQUEST, "INVALID_LENGTH", "Invalid Content-Length.")
    if size > MAX_BODY_BYTES:
        return _error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "BODY_TOO_LARGE",
                      "The request body exceeds 8 KiB.")

    try:
        body = environ["wsgi.input"].read(size)
        if len(body) != size:
            raise ValueError
        payload = json.loads(body.decode("utf-8"), parse_constant=_reject_json_constant)
    except (ValueError, RecursionError):
        return _error(HTTPStatus.BAD_REQUEST, "INVALID_JSON", "Send a valid JSON request body.")

    if not isinstance(payload, dict) or payload.get("format") != "GRID_2D":
        return _error(HTTPStatus.UNPROCESSABLE_ENTITY, "UNSUPPORTED_FORMAT",
                      "Use the GRID_2D board format.")

    board = payload.get("sudoku_board")
    validation_error = validate_board(board)
    if validation_error:
        return _error(HTTPStatus.UNPROCESSABLE_ENTITY, "INVALID_BOARD", validation_error)

    method = payload.get("method", "classic")
    model = payload.get("model")
    if method not in ("classic", "hybrid"):
        return _error(HTTPStatus.UNPROCESSABLE_ENTITY, "INVALID_METHOD",
                      "Use the classic or hybrid solving method.")
    if method == "classic" and model is not None:
        return _error(HTTPStatus.UNPROCESSABLE_ENTITY, "UNEXPECTED_MODEL",
                      "The classic method has no model.")
    if method == "hybrid" and (not isinstance(model, str) or model not in MODEL_IDS):
        return _error(HTTPStatus.UNPROCESSABLE_ENTITY, "INVALID_MODEL",
                      "Choose smollm2-135m or smollm2-360m for the hybrid method.")

    try:
        choose_digit = load_model(model) if method == "hybrid" else None
    except ModelUnavailable as error:
        return _error(HTTPStatus.SERVICE_UNAVAILABLE, "MODEL_UNAVAILABLE", str(error))

    solution, stats = solve_board_with_stats(board, choose_digit)
    metadata = {"method": method, "model": model, "stats": asdict(stats)}
    if solution is None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "code": "UNSOLVABLE",
            "message": "This board has no valid Sudoku solution.",
            **metadata,
        }
    return HTTPStatus.OK, {"solution": solution, **metadata}


def application(environ, start_response):
    method = environ["REQUEST_METHOD"]
    origin = environ.get("HTTP_ORIGIN")
    headers = [("Vary", "Origin")]
    if origin in FRONTEND_ORIGINS:
        headers.extend([
            ("Access-Control-Allow-Origin", origin),
            ("Access-Control-Allow-Methods", "POST, OPTIONS"),
            ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
        ])

    if environ["PATH_INFO"] != SOLVE_PATH:
        status, payload = _error(HTTPStatus.NOT_FOUND, "NOT_FOUND", "Endpoint not found.")
    elif method == "OPTIONS":
        status, payload = HTTPStatus.NO_CONTENT, None
    elif method != "POST":
        headers.append(("Allow", "POST, OPTIONS"))
        status, payload = _error(HTTPStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED",
                                 "Use POST to solve a Sudoku.")
    else:
        status, payload = _solve_request(environ)

    body = b""
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers.extend([
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))),
        ])
    start_response(f"{status.value} {status.phrase}", headers)
    return [] if method == "HEAD" else [body]


if __name__ == "__main__":
    with make_server(HOST, PORT, application) as server:
        print(f"Sudoku API listening at http://localhost:{PORT}{SOLVE_PATH}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
