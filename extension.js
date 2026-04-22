"use strict";

const path = require("path");
const vscode = require("vscode");

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("customTelescope.findDefinitions", async () => {
      await openLocationPicker({
        providerCommand: "vscode.executeDefinitionProvider",
        noResultsMessage: "No definitions found for the symbol under the cursor.",
        pickerTitle: "Definitions",
        pickerPlaceholder: "Select a definition"
      });
    }),
    vscode.commands.registerCommand("customTelescope.findImplementations", async () => {
      await openLocationPicker({
        providerCommand: "vscode.executeImplementationProvider",
        noResultsMessage: "No implementations found for the symbol under the cursor.",
        pickerTitle: "Implementations",
        pickerPlaceholder: "Select an implementation"
      });
    }),
    vscode.commands.registerCommand("customTelescope.findReferences", async () => {
      await openLocationPicker({
        providerCommand: "vscode.executeReferenceProvider",
        noResultsMessage: "No references found for the symbol under the cursor.",
        pickerTitle: "References",
        pickerPlaceholder: "Select a reference"
      });
    })
  );
}

async function openLocationPicker(options) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showWarningMessage("Open a file and place the cursor on a symbol first.");
    return;
  }

  const { document, selection } = editor;
  const position = selection.active;
  const locations = await vscode.commands.executeCommand(options.providerCommand, document.uri, position);
  const normalizedLocations = dedupeLocations(normalizeLocations(locations));

  if (normalizedLocations.length === 0) {
    await vscode.window.showInformationMessage(options.noResultsMessage);
    return;
  }

  const items = await Promise.all(
    normalizedLocations.map(async (location) => {
      const preview = await buildPreview(location.uri, location.range.start.line);
      const relativePath = vscode.workspace.asRelativePath(location.uri, false);
      const basename = path.basename(location.uri.fsPath || location.uri.path);
      const line = location.range.start.line + 1;
      const column = location.range.start.character + 1;

      return {
        label: basename,
        description: `${relativePath}:${line}:${column}`,
        detail: preview,
        location
      };
    })
  );

  const picked = await vscode.window.showQuickPick(items, {
    matchOnDescription: true,
    matchOnDetail: true,
    title: options.pickerTitle,
    placeHolder: options.pickerPlaceholder
  });

  if (!picked) {
    return;
  }

  await openLocation(picked.location);
}

function normalizeLocations(locations) {
  if (!Array.isArray(locations)) {
    return [];
  }

  return locations
    .map((location) => {
      if (location && location.uri && location.range) {
        return {
          uri: location.uri,
          range: location.range
        };
      }

      if (location && location.targetUri && (location.targetSelectionRange || location.targetRange)) {
        return {
          uri: location.targetUri,
          range: location.targetSelectionRange || location.targetRange
        };
      }

      return null;
    })
    .filter(Boolean);
}

function dedupeLocations(locations) {
  const seen = new Set();
  const result = [];

  for (const location of locations) {
    const key = [
      location.uri.toString(),
      location.range.start.line,
      location.range.start.character,
      location.range.end.line,
      location.range.end.character
    ].join(":");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(location);
  }

  return result;
}

async function buildPreview(uri, lineNumber) {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    if (lineNumber >= document.lineCount) {
      return "";
    }

    return document.lineAt(lineNumber).text.trim();
  } catch {
    return "";
  }
}

async function openLocation(location) {
  const document = await vscode.workspace.openTextDocument(location.uri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    selection: location.range
  });

  editor.revealRange(location.range, vscode.TextEditorRevealType.InCenter);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
