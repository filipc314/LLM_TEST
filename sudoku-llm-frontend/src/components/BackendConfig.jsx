import React, { useState } from 'react';
import { PayloadFormat, formatPayload } from '../services/backendApi';

export default function BackendConfig({
  config,
  onChangeConfig,
  currentBoard,
  isOpen,
  onToggle
}) {
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);

  const formattedData = formatPayload(currentBoard, config.payloadFormat);

  const previewPayload = {
    sudoku_board: formattedData,
    format: config.payloadFormat,
    model_params: {
      temperature: 0.1,
      task: 'solve_sudoku'
    },
    timestamp: new Date().toISOString()
  };

  return (
    <div className="backend-config-card">
      <div className="config-header" onClick={onToggle}>
        <div className="config-title">
          <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Backend & LLM API Configuration</span>
        </div>
        <div className="config-header-badges">
          {config.useMock && <span className="badge badge-warning">Simulated Mock Mode</span>}
          {!config.useMock && <span className="badge badge-success">Live Backend Mode</span>}
          <span className="toggle-chevron">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div className="config-body">
          <p className="config-description">
            Customize how data is sent to your LLM backend server. You can change the endpoint URL,
            authentication headers, and board data payload format.
          </p>

          <div className="form-grid">
            {/* Backend URL */}
            <div className="form-group full-width">
              <label htmlFor="backend-url" className="form-label">
                Backend API Endpoint URL
              </label>
              <input
                id="backend-url"
                type="text"
                className="form-input"
                placeholder="http://localhost:8000/api/solve-sudoku"
                value={config.endpoint}
                onChange={(e) => onChangeConfig({ ...config, endpoint: e.target.value })}
                disabled={config.useMock}
              />
              <span className="field-hint">
                The POST endpoint of your custom LLM backend service.
              </span>
            </div>

            {/* Payload Format */}
            <div className="form-group">
              <label htmlFor="payload-format" className="form-label">
                Board Data Format
              </label>
              <select
                id="payload-format"
                className="form-select"
                value={config.payloadFormat}
                onChange={(e) => onChangeConfig({ ...config, payloadFormat: e.target.value })}
              >
                <option value={PayloadFormat.GRID_2D}>2D Array (number[9][9])</option>
                <option value={PayloadFormat.STRING_81}>81-Character String (e.g. 53007...)</option>
                <option value={PayloadFormat.COORDINATES}>List of Known Clues ({'{row, col, value}'})</option>
                <option value={PayloadFormat.PROMPT_TEXT}>ASCII Prompt Grid (for direct LLMs)</option>
              </select>
            </div>

            {/* API Key (Optional) */}
            <div className="form-group">
              <label htmlFor="api-key" className="form-label">
                Authorization Token / API Key (Optional)
              </label>
              <input
                id="api-key"
                type="password"
                className="form-input"
                placeholder="Bearer eyJhbGci..."
                value={config.apiKey}
                onChange={(e) => onChangeConfig({ ...config, apiKey: e.target.value })}
                disabled={config.useMock}
              />
            </div>

            {/* Mock Mode Toggle */}
            <div className="form-group full-width checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.useMock}
                  onChange={(e) => onChangeConfig({ ...config, useMock: e.target.checked })}
                />
                <span className="checkbox-text">
                  <strong>Enable Local Mock Simulation</strong>
                  <span className="checkbox-subtext">
                    (Use this to test and preview the frontend UI while your backend/LLM is being set up)
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Live Payload Preview Toggle */}
          <div className="payload-preview-section">
            <button
              type="button"
              className="btn btn-text"
              onClick={() => setShowPayloadPreview(!showPayloadPreview)}
            >
              {showPayloadPreview ? 'Hide Outgoing JSON Payload Preview' : 'Preview Outgoing JSON Payload to Backend'}
            </button>

            {showPayloadPreview && (
              <div className="payload-code-block">
                <div className="payload-code-header">
                  <span>POST {config.endpoint}</span>
                  <span className="format-tag">{config.payloadFormat}</span>
                </div>
                <pre>{JSON.stringify(previewPayload, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
