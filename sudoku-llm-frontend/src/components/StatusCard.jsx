import React, { useState } from 'react';
import { SOLVER_METRICS, SOLVER_MODES } from '../services/backendApi';

export default function StatusCard({
  status,
  error,
  result,
  comparison,
  cluesCount,
  conflictsCount,
  isSolving,
  useMock
}) {
  const [showRaw, setShowRaw] = useState(false);
  const rawResponse = result?.rawResponse;
  const responseLabel = result?.fromMock ? 'Mock Details' : 'Backend Response';
  const comparedModes = SOLVER_MODES.filter(({ id }) => comparison[id]);

  return (
    <div className="status-card">
      <div className="status-row">
        {/* Clues & Conflicts Stats */}
        <div className="stats-badges">
          <span className="stat-badge">
            Clues: <strong>{cluesCount}</strong> / 81
          </span>
          {conflictsCount > 0 ? (
            <span className="stat-badge stat-badge-danger">
              ⚠️ {conflictsCount} Conflict{conflictsCount > 1 ? 's' : ''} Found
            </span>
          ) : (
            <span className="stat-badge stat-badge-success">✓ No Conflicts</span>
          )}
          {result && (
            <span className="stat-badge stat-badge-info">
              ⚡ {result.fromMock ? 'Mock Time' : 'Backend Time'}: {result.latencyMs} ms
            </span>
          )}
        </div>

        {rawResponse && (
          <button
            type="button"
            className="btn btn-text-sm"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? 'Hide' : 'View'} {responseLabel}
          </button>
        )}
      </div>

      {/* Solving Indicator */}
      {isSolving && (
        <div className="status-banner status-loading">
          <span className="pulse-dot"></span>
          <span>{useMock ? 'Running the local Sudoku solver...' : 'Waiting for the backend to return a solution...'}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="status-banner status-error">
          <div className="error-icon">❌</div>
          <div className="error-content">
            <strong>Solver Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Success Alert */}
      {status === 'success' && !error && (
        <div className="status-banner status-success">
          <div className="success-icon">✨</div>
          <div className="success-content">
            <strong>{result?.fromMock ? 'Sudoku solved locally (mock).' : 'Sudoku solved by the backend.'}</strong>
          </div>
        </div>
      )}

      {comparedModes.length > 0 && (
        <div className="comparison-table-container">
          <table className="comparison-table">
            <caption>Results for this puzzle</caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {comparedModes.map(({ id, label }) => <th key={id} scope="col">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Result</th>
                {comparedModes.map(({ id }) => (
                  <td key={id}>{comparison[id].error ? 'Failed' : 'Solved'}</td>
                ))}
              </tr>
              {SOLVER_METRICS.map(([key, label]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {comparedModes.map(({ id }) => {
                    const value = comparison[id].stats?.[key];
                    return <td key={id}>{key === 'elapsed_ms' ? value?.toFixed(2) ?? '—' : value ?? '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw Backend Response Drawer */}
      {showRaw && rawResponse && (
        <div className="raw-response-box">
          <div className="raw-response-title">{responseLabel}</div>
          <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
