import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRequestBody, parseBackendResponse, SOLVER_MODES, solveSudokuWithLLM } from '../src/services/backendApi.js';

const data = await readFile(new URL('../../benchmark/puzzles.json', import.meta.url), 'utf8');
const { board } = JSON.parse(data).puzzles.find(puzzle => puzzle.id === 'medium-01');
const endpoint = process.env.SUDOKU_TEST_ENDPOINT;

test('all three modes send only GRID_2D', () => {
  for (const { id } of SOLVER_MODES) {
    const classic = id === 'classic';
    assert.deepEqual(buildRequestBody(board, id), {
      sudoku_board: board,
      format: 'GRID_2D',
      method: classic ? 'classic' : 'hybrid',
      model: classic ? null : id,
    });
  }
});

test('client validates clues and accepts solver metadata', async () => {
  const { solution } = await solveSudokuWithLLM(board, { useMock: true });
  assert.deepEqual(parseBackendResponse({ solution, stats: { model_calls: 0 } }, board), solution);
  const changed = solution.map(row => row.map(digit => digit === 1 ? 2 : digit === 2 ? 1 : digit));
  assert.throws(() => parseBackendResponse({ solution: changed }, board), /original clues/);
});

test('real HTTP client uses the selected model and receives its statistics', { skip: !endpoint }, async () => {
  const preflight = await fetch(endpoint, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3000');

  let expected;
  for (const { id } of SOLVER_MODES) {
    const classic = id === 'classic';
    const { solution, stats, rawResponse } = await solveSudokuWithLLM(board, { endpoint, mode: id });
    expected ??= solution;
    assert.deepEqual(solution, expected);
    assert.equal(rawResponse.method, classic ? 'classic' : 'hybrid');
    assert.equal(rawResponse.model, classic ? null : id);
    assert.equal(stats.model_errors, 0);
    assert.equal(stats.model_calls > 0, !classic);
    assert.ok(stats.elapsed_ms > 0);
    assert.equal(stats.attempts - stats.backtracks, board.flat().filter(digit => digit === 0).length);
  }
});
