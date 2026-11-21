import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('React renders the board, method selector, and three-method comparison', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
    const page = renderToStaticMarkup(React.createElement(App));
    assert.equal((page.match(/class="cell-input"/g) || []).length, 81);
    assert.match(page, /Compare all methods/);
    for (const label of ['Classic MRV', 'MRV + SmolLM2 135M', 'MRV + SmolLM2 360M']) {
      assert.ok(page.includes(label));
    }

    const { default: StatusCard } = await vite.ssrLoadModule('/src/components/StatusCard.jsx');
    const stats = {
      elapsed_ms: 2.5, attempts: 12, backtracks: 2, model_calls: 1,
      invalid_model_responses: 1, model_errors: 0,
    };
    const comparison = {
      classic: { stats },
      'smollm2-135m': { stats },
      'smollm2-360m': { error: 'Model unavailable' },
    };
    const card = renderToStaticMarkup(React.createElement(StatusCard, { comparison }));
    assert.match(card, /Results for this puzzle/);
    assert.match(card, /Invalid replies/);
    assert.match(card, /Inference errors/);
    assert.match(card, /<td>2\.50<\/td>/);
    assert.match(card, /<td>Failed<\/td>/);
  } finally {
    await vite.close();
  }
});
