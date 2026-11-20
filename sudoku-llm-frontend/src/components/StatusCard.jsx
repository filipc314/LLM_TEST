import React, { useState } from 'react';

export default function StatusCard({
  status,
  error,
  latencyMs,
  cluesCount,
  conflictsCount,
  rawResponse,
  isSolving
}) {
  const [showRaw, setShowRaw] = useState(false);

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
            <span className="stat-badge stat-badge-success">✓ Grid Valid</span>
          )}
          {latencyMs !== null && (
            <span className="stat-badge stat-badge-info">
              ⚡ LLM Latency: {latencyMs}ms
            </span>
          )}
        </div>

        {rawResponse && (
          <button
            type="button"
            className="btn btn-text-sm"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? 'Hide Raw LLM Response' : 'View Backend Response'}
          </button>
        )}
      </div>

      {/* Solving Indicator */}
      {isSolving && (
        <div className="status-banner status-loading">
          <span className="pulse-dot"></span>
          <span>Sending board state to LLM backend and waiting for solution...</span>
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
            <strong>Sudoku successfully resolved!</strong> Newly filled numbers are highlighted with green badges.
          </div>
        </div>
      )}

      {/* Raw Backend Response Drawer */}
      {showRaw && rawResponse && (
        <div className="raw-response-box">
          <div className="raw-response-title">Raw Response Received from Backend:</div>
          <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
