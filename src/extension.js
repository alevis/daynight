"use strict";

const vscode = require("vscode");
const {
  createDefaultSchedules,
  getActiveSchedule,
  getNextBoundaryDelay,
  validateSchedules
} = require("./scheduler");
const { getWebviewHtml } = require("./webview");

const STORAGE_KEY = "daynight.schedules";
const FORMAT_KEY = "daynight.timeFormat";

let currentPanel = null;
let nextTimer = null;
let statusBar = null;

function activate(context) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "daynight.openScheduler";
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("daynight.openScheduler", () => openScheduler(context))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("daynight.applyOnStartup")) {
        scheduleNextThemeUpdate(context);
      }
    })
  );

  context.subscriptions.push({
    dispose() {
      if (nextTimer) {
        clearTimeout(nextTimer);
      }
    }
  });

  refreshStatusBar(context);

  if (vscode.workspace.getConfiguration("daynight").get("applyOnStartup", true)) {
    applyMatchingTheme(context, false);
  }
  scheduleNextThemeUpdate(context);
}

function deactivate() {
  if (nextTimer) {
    clearTimeout(nextTimer);
  }
}

function openScheduler(context) {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "daynightScheduler",
    "DayNight Theme Scheduler",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [context.extensionUri],
      retainContextWhenHidden: true
    }
  );

  const render = (message) => {
    currentPanel.webview.html = getWebviewHtml(currentPanel.webview, context, {
      schedules: getSavedSchedules(context),
      hasStoredSchedules: Boolean(getStoredSchedules(context)),
      timeFormat: context.globalState.get(FORMAT_KEY, "24h"),
      themes: getThemeOptions(),
      currentTheme: getCurrentThemeLabel(),
      previewTime: new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date()),
      message: message || ""
    });
  };

  render("");

  currentPanel.onDidDispose(
    () => {
      currentPanel = null;
    },
    null,
    context.subscriptions
  );

  currentPanel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.type === "save") {
        const result = validateSchedules(message.schedules);
        if (!result.ok) {
          currentPanel.webview.postMessage({
            type: "error",
            text: result.errors.join(" ")
          });
          return;
        }

        const validThemes = new Set(getThemeOptions().map((theme) => theme.id));
        const invalidThemeSchedule = result.schedules.find(
          (schedule, index) => schedule.enabled && schedule.theme && !validThemes.has(schedule.theme)
        );
        if (invalidThemeSchedule) {
          currentPanel.webview.postMessage({
            type: "error",
            text: `Range ${result.schedules.indexOf(invalidThemeSchedule) + 1}: choose a theme from the installed-theme suggestions.`,
            invalidThemeIds: [invalidThemeSchedule.id]
          });
          return;
        }

        await context.globalState.update(STORAGE_KEY, result.schedules);
        await context.globalState.update(FORMAT_KEY, message.timeFormat === "12h" ? "12h" : "24h");
        refreshStatusBar(context);
        await applyMatchingTheme(context, true);
        render("Schedule saved. Matching theme applied if one is active right now.");
        return;
      }

      if (message.type === "reset") {
        await context.globalState.update(STORAGE_KEY, undefined);
        refreshStatusBar(context);
        scheduleNextThemeUpdate(context);
        render("Reset to the default layout.");
        return;
      }

      if (message.type === "preview") {
        const previewSchedule = getActiveSchedule(message.schedules);
        currentPanel.webview.postMessage({
          type: "preview",
          ok: Boolean(previewSchedule),
          text: previewSchedule
            ? `Current time matches "${previewSchedule.theme}".`
            : "No configured range matches the current time."
        });
        return;
      }

      if (message.type === "timeFormatChanged") {
        await context.globalState.update(FORMAT_KEY, message.timeFormat === "12h" ? "12h" : "24h");
      }
    },
    null,
    context.subscriptions
  );
}

function getStoredSchedules(context) {
  const saved = context.globalState.get(STORAGE_KEY);
  return Array.isArray(saved) ? saved : null;
}

function getSavedSchedules(context) {
  return getStoredSchedules(context) || createDefaultSchedules();
}

function getThemeOptions() {
  const seen = new Set();
  const options = [];

  vscode.extensions.all.forEach((extension) => {
    const themes = extension.packageJSON?.contributes?.themes;
    if (!Array.isArray(themes)) {
      return;
    }

    themes.forEach((theme) => {
      if (!theme?.label || seen.has(theme.label)) {
        return;
      }

      seen.add(theme.label);
      options.push({
        id: theme.label,
        label: theme.label
      });
    });
  });

  const current = getCurrentThemeLabel();
  if (current && !seen.has(current)) {
    options.unshift({ id: current, label: current });
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

function getCurrentThemeLabel() {
  return vscode.workspace.getConfiguration("workbench").get("colorTheme", "");
}

async function applyMatchingTheme(context, showErrors) {
  const schedules = getSavedSchedules(context);
  const active = getActiveSchedule(schedules);

  if (!active || !active.theme) {
    refreshStatusBar(context);
    scheduleNextThemeUpdate(context);
    return;
  }

  const currentTheme = getCurrentThemeLabel();
  if (currentTheme === active.theme) {
    refreshStatusBar(context, active.theme);
    scheduleNextThemeUpdate(context);
    return;
  }

  try {
    await vscode.workspace
      .getConfiguration("workbench")
      .update("colorTheme", active.theme, vscode.ConfigurationTarget.Global);
    refreshStatusBar(context, active.theme);
  } catch (error) {
    if (showErrors) {
      vscode.window.showErrorMessage(`DayNight could not apply theme "${active.theme}".`);
    }
  } finally {
    scheduleNextThemeUpdate(context);
  }
}

function scheduleNextThemeUpdate(context) {
  if (nextTimer) {
    clearTimeout(nextTimer);
  }

  const delay = getNextBoundaryDelay(getSavedSchedules(context));
  nextTimer = setTimeout(() => {
    applyMatchingTheme(context, false);
  }, delay);
}

function refreshStatusBar(context, activeTheme) {
  const schedules = getSavedSchedules(context);
  const active = activeTheme
    ? { theme: activeTheme }
    : getActiveSchedule(schedules) || { theme: "No active range" };
  const enabledCount = schedules.filter((schedule) => schedule.enabled).length;

  statusBar.text = `$(watch) DayNight: ${active.theme}`;
  statusBar.tooltip = `${enabledCount} active range${enabledCount === 1 ? "" : "s"}. Click to edit the scheduler.`;
  statusBar.show();
}

module.exports = {
  activate,
  deactivate
};
