"use strict";

const { MAX_SCHEDULES, formatTime, parseTimeString } = require("./scheduler");

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getWebviewHtml(webview, context, payload) {
  const nonce = String(Date.now());
  const scheduleCards = payload.schedules
    .slice(0, MAX_SCHEDULES)
    .map((schedule, index) => renderCard(schedule, index, payload))
    .join("");

  const state = JSON.stringify(payload);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>DayNight Theme Scheduler</title>
  <style>
    :root {
      --bg-1: #081420;
      --bg-2: #102e43;
      --bg-3: #f49d37;
      --text: #eff6ff;
      --muted: rgba(239, 246, 255, 0.72);
      --glass: rgba(255, 255, 255, 0.12);
      --glass-strong: rgba(255, 255, 255, 0.18);
      --border: rgba(255, 255, 255, 0.2);
      --accent: #ffd166;
      --accent-strong: #ffb703;
      --shadow: 0 28px 60px rgba(0, 0, 0, 0.35);
      --danger: #ff8a80;
      --success: #80ed99;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(255, 209, 102, 0.25), transparent 28%),
        radial-gradient(circle at bottom right, rgba(0, 180, 216, 0.24), transparent 24%),
        linear-gradient(140deg, var(--bg-1), var(--bg-2) 55%, #19354a 100%);
      padding: 28px;
    }

    .shell {
      max-width: 1120px;
      margin: 0 auto;
    }

    .hero {
      display: grid;
      gap: 18px;
      grid-template-columns: 1.2fr 0.8fr;
      margin-bottom: 22px;
    }

    .glass {
      background: linear-gradient(180deg, var(--glass-strong), var(--glass));
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
    }

    .headline {
      padding: 26px;
    }

    .headline h1 {
      margin: 0 0 12px;
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
      font-weight: 700;
    }

    .headline p,
    .summary p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 0.98rem;
    }

    .summary {
      padding: 22px;
      display: grid;
      align-content: space-between;
      gap: 18px;
    }

    .summary-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat {
      padding: 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .stat strong {
      display: block;
      font-size: 1.2rem;
      margin-bottom: 2px;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      margin-bottom: 18px;
    }

    .toolbar-left,
    .toolbar-right {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .segmented {
      display: inline-flex;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .segmented button,
    button.action,
    button.ghost {
      border: none;
      color: var(--text);
      cursor: pointer;
      font: inherit;
    }

    .segmented button {
      padding: 10px 14px;
      border-radius: 999px;
      background: transparent;
      opacity: 0.75;
    }

    .segmented button.active {
      background: rgba(255, 209, 102, 0.18);
      opacity: 1;
    }

    button.action {
      padding: 12px 18px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--accent), var(--accent-strong));
      color: #18212c;
      font-weight: 700;
      box-shadow: 0 16px 30px rgba(255, 183, 3, 0.22);
    }

    button.ghost {
      padding: 12px 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .message {
      min-height: 22px;
      color: var(--muted);
      margin-bottom: 16px;
      transition: color 120ms ease, transform 120ms ease;
    }

    .message.error {
      color: var(--danger);
    }

    .message.success {
      color: var(--success);
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 18px;
    }

    .schedule-card {
      padding: 18px;
      position: relative;
      overflow: hidden;
    }

    .schedule-card::after {
      content: "";
      position: absolute;
      inset: auto -40px -40px auto;
      width: 160px;
      height: 160px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.14), transparent 70%);
      pointer-events: none;
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .slot-label {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .toggle {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      font-size: 0.9rem;
      color: var(--muted);
    }

    .toggle input {
      width: 18px;
      height: 18px;
      accent-color: var(--accent);
    }

    .field {
      display: grid;
      gap: 8px;
      margin-bottom: 14px;
    }

    .field label {
      color: var(--muted);
      font-size: 0.88rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .field input,
    .field select {
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(6, 20, 32, 0.38);
      color: var(--text);
      border-radius: 14px;
      padding: 12px 14px;
      font: inherit;
      outline: none;
    }

    .field input::placeholder {
      color: rgba(239, 246, 255, 0.35);
    }

    .hint {
      font-size: 0.82rem;
      color: rgba(239, 246, 255, 0.55);
      line-height: 1.4;
    }

    .footer-note {
      margin-top: 18px;
      color: rgba(239, 246, 255, 0.52);
      font-size: 0.88rem;
    }

    @media (max-width: 840px) {
      body {
        padding: 16px;
      }

      .hero {
        grid-template-columns: 1fr;
      }

      .toolbar {
        align-items: stretch;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="glass headline">
        <p style="margin-bottom: 10px; color: rgba(255, 255, 255, 0.6); text-transform: uppercase; letter-spacing: 0.14em;">DayNight</p>
        <h1>Theme switching that actually feels designed.</h1>
        <p>Set up to four non-overlapping time ranges, mix 12-hour and 24-hour inputs, and let the extension swap themes automatically at each boundary.</p>
      </div>
      <div class="glass summary">
        <div class="summary-grid">
          <div class="stat">
            <strong>${escapeHtml(String(payload.themes.length))}</strong>
            <span>themes detected</span>
          </div>
          <div class="stat">
            <strong>${escapeHtml(String(payload.schedules.filter((item) => item.enabled).length))}</strong>
            <span>active ranges</span>
          </div>
          <div class="stat">
            <strong>${escapeHtml(payload.currentTheme || "Unknown")}</strong>
            <span>current theme</span>
          </div>
          <div class="stat">
            <strong>${escapeHtml(payload.previewTime)}</strong>
            <span>local time now</span>
          </div>
        </div>
        <p>Use adjacent time ranges for handoffs. An overnight range like <strong>10:00 PM → 6:00 AM</strong> is supported.</p>
      </div>
    </section>

    <section class="toolbar">
      <div class="toolbar-left">
        <div class="segmented">
          <button type="button" class="${payload.timeFormat === "12h" ? "active" : ""}" data-format="12h">12-hour</button>
          <button type="button" class="${payload.timeFormat === "24h" ? "active" : ""}" data-format="24h">24-hour</button>
        </div>
        <button type="button" class="ghost" id="preview-now">Preview Current Match</button>
      </div>
      <div class="toolbar-right">
        <button type="button" class="ghost" id="reset">Reset</button>
        <button type="button" class="action" id="save">Save Schedule</button>
      </div>
    </section>

    <div class="message" id="message">${payload.message ? escapeHtml(payload.message) : ""}</div>

    <section class="card-grid">
      ${scheduleCards}
    </section>

    <p class="footer-note">Accepted examples: <strong>06:30</strong>, <strong>18:30</strong>, <strong>6:30 AM</strong>, <strong>10 PM</strong>. If ranges overlap, saving is blocked to keep switching deterministic.</p>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const initialState = ${state};
    let timeFormat = initialState.timeFormat;

    function normalizeForDisplay(value) {
      const minutes = parseTime(value);
      if (minutes === null) {
        return value || "";
      }
      return formatTimeValue(minutes, timeFormat);
    }

    function parseTime(value) {
      const raw = String(value || "").trim().toUpperCase();
      if (!raw) {
        return null;
      }
      const twelve = raw.match(/^(\\d{1,2})(?::(\\d{2}))?\\s*([AP]M)$/);
      if (twelve) {
        const hour = Number(twelve[1]);
        const minute = Number(twelve[2] || "0");
        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
          return null;
        }
        return (hour % 12 + (twelve[3] === "PM" ? 12 : 0)) * 60 + minute;
      }
      const twentyFour = raw.match(/^(\\d{1,2}):(\\d{2})$/);
      if (twentyFour) {
        const hour = Number(twentyFour[1]);
        const minute = Number(twentyFour[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          return null;
        }
        return hour * 60 + minute;
      }
      return null;
    }

    function formatTimeValue(totalMinutes, format) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (format === "12h") {
        const meridiem = hours >= 12 ? "PM" : "AM";
        const hour = hours % 12 || 12;
        return \`\${hour}:\${String(minutes).padStart(2, "0")} \${meridiem}\`;
      }
      return \`\${String(hours).padStart(2, "0")}:\${String(minutes).padStart(2, "0")}\`;
    }

    function currentPayload() {
      return Array.from(document.querySelectorAll(".schedule-card")).map((card) => ({
        id: card.dataset.id,
        enabled: card.querySelector('[data-field="enabled"]').checked,
        theme: card.querySelector('[data-field="theme"]').value,
        start: card.querySelector('[data-field="start"]').value.trim(),
        end: card.querySelector('[data-field="end"]').value.trim()
      }));
    }

    function setMessage(text, type) {
      const node = document.getElementById("message");
      node.textContent = text || "";
      node.className = type ? \`message \${type}\` : "message";
    }

    document.querySelectorAll("[data-format]").forEach((button) => {
      button.addEventListener("click", () => {
        timeFormat = button.dataset.format;
        document.querySelectorAll("[data-format]").forEach((item) => {
          item.classList.toggle("active", item.dataset.format === timeFormat);
        });
        document.querySelectorAll('input[data-field="start"], input[data-field="end"]').forEach((input) => {
          input.value = normalizeForDisplay(input.value);
          input.placeholder = timeFormat === "12h" ? "6:30 PM" : "18:30";
        });
        vscode.postMessage({ type: "timeFormatChanged", timeFormat });
      });
    });

    document.getElementById("save").addEventListener("click", () => {
      vscode.postMessage({ type: "save", schedules: currentPayload(), timeFormat });
    });

    document.getElementById("reset").addEventListener("click", () => {
      vscode.postMessage({ type: "reset" });
    });

    document.getElementById("preview-now").addEventListener("click", () => {
      vscode.postMessage({ type: "preview", schedules: currentPayload() });
    });

    document.querySelectorAll('input[data-field="start"], input[data-field="end"]').forEach((input) => {
      input.addEventListener("blur", () => {
        const parsed = parseTime(input.value);
        if (parsed !== null) {
          input.value = formatTimeValue(parsed, timeFormat);
        }
      });
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "error") {
        setMessage(message.text, "error");
      }
      if (message.type === "preview") {
        setMessage(message.text, message.ok ? "success" : "");
      }
    });
  </script>
</body>
</html>`;
}

function renderCard(schedule, index, payload) {
  const previewStart = formatExistingValue(schedule.start, payload.timeFormat);
  const previewEnd = formatExistingValue(schedule.end, payload.timeFormat);
  const options = payload.themes
    .map((theme) => {
      const selected = theme.id === schedule.theme ? "selected" : "";
      return `<option value="${escapeAttribute(theme.id)}" ${selected}>${escapeHtml(theme.label)}</option>`;
    })
    .join("");

  return `<article class="glass schedule-card" data-id="${escapeAttribute(schedule.id)}">
    <div class="card-head">
      <div class="slot-label">Range ${index + 1}</div>
      <label class="toggle">
        <input type="checkbox" data-field="enabled" ${schedule.enabled ? "checked" : ""} />
        Enabled
      </label>
    </div>
    <div class="field">
      <label>Theme</label>
      <select data-field="theme">
        <option value="">Select a theme</option>
        ${options}
      </select>
    </div>
    <div class="field">
      <label>Start time</label>
      <input
        type="text"
        data-field="start"
        value="${escapeAttribute(previewStart)}"
        placeholder="${payload.timeFormat === "12h" ? "6:30 PM" : "18:30"}"
      />
    </div>
    <div class="field">
      <label>End time</label>
      <input
        type="text"
        data-field="end"
        value="${escapeAttribute(previewEnd)}"
        placeholder="${payload.timeFormat === "12h" ? "11:00 PM" : "23:00"}"
      />
    </div>
    <div class="hint">Ranges can cross midnight. Example: 10:00 PM to 6:00 AM.</div>
  </article>`;
}

function formatExistingValue(value, timeFormat) {
  const minutes = parseTimeString(value || "");
  if (minutes === null) {
    return value || "";
  }
  return formatTime(minutes, timeFormat);
}

module.exports = {
  getWebviewHtml
};
