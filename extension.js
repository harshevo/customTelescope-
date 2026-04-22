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
    }),
    vscode.commands.registerCommand("customTelescope.findWordInWorkspace", async () => {
      await openCurrentWordInWorkspaceSearch();
    }),
    vscode.commands.registerCommand("customTelescope.findInCurrentFile", async () => {
      await openCurrentFilePicker();
    })
  );
}

async function openCurrentFilePicker() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showWarningMessage("Open a file first.");
    return;
  }

  const document = editor.document;
  const items = [];
  const lineCount = document.lineCount;
  const padWidth = String(lineCount).length;

  for (let lineNumber = 0; lineNumber < lineCount; lineNumber += 1) {
    const lineText = document.lineAt(lineNumber).text;
    if (lineText.trim().length === 0) {
      continue;
    }

    items.push({
      label: `${String(lineNumber + 1).padStart(padWidth, " ")}  ${lineText}`,
      lineNumber
    });
  }

  if (items.length === 0) {
    await vscode.window.showInformationMessage("No non-empty lines in this file.");
    return;
  }

  const basename = path.basename(document.uri.fsPath || document.uri.path);
  const startSelection = editor.selection;
  const startVisible = editor.visibleRanges[0];

  const picker = vscode.window.createQuickPick();
  picker.items = items;
  picker.title = `Find in ${basename}`;
  picker.placeholder = "Type to filter lines";
  picker.matchOnDescription = false;
  picker.matchOnDetail = false;

  picker.onDidChangeActive((active) => {
    const item = active[0];
    if (!item) {
      return;
    }
    const range = new vscode.Range(item.lineNumber, 0, item.lineNumber, 0);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  });

  picker.onDidAccept(() => {
    const item = picker.activeItems[0];
    picker.hide();
    if (!item) {
      return;
    }
    const position = new vscode.Position(item.lineNumber, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  });

  picker.onDidHide(() => {
    if (!picker.selectedItems[0]) {
      editor.selection = startSelection;
      if (startVisible) {
        editor.revealRange(startVisible, vscode.TextEditorRevealType.Default);
      }
    }
    picker.dispose();
  });

  picker.show();
}

async function openCurrentWordInWorkspaceSearch() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await vscode.window.showWarningMessage("Open a file and place the cursor on a word first.");
    return;
  }

  const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
  if (!wordRange) {
    await vscode.window.showInformationMessage("No word found under the cursor.");
    return;
  }

  const word = editor.document.getText(wordRange);
  if (!word) {
    await vscode.window.showInformationMessage("No word found under the cursor.");
    return;
  }

  const items = [];
  await vscode.workspace.findTextInFiles(
    {
      pattern: word,
      isRegExp: false,
      isCaseSensitive: false,
      isWordMatch: true
    },
    {
      useIgnoreFiles: true,
      useGlobalIgnoreFiles: true,
      followSymlinks: true,
      maxResults: 500
    },
    (result) => {
      for (const match of normalizeTextSearchResult(result)) {
        items.push(match);
      }
    }
  );

  if (items.length === 0) {
    await vscode.window.showInformationMessage(`No workspace matches found for "${word}".`);
    return;
  }

  const picked = await vscode.window.showQuickPick(items, {
    matchOnDescription: true,
    matchOnDetail: true,
    title: `Workspace Matches: ${word}`,
    placeHolder: "Select a match"
  });

  if (!picked) {
    return;
  }

  await openLocation(picked.location);
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

function normalizeTextSearchResult(result) {
  const ranges = Array.isArray(result.ranges) ? result.ranges : [result.ranges];
  const previewMatches = Array.isArray(result.preview.matches)
    ? result.preview.matches
    : [result.preview.matches];
  const relativePath = vscode.workspace.asRelativePath(result.uri, false);
  const basename = path.basename(result.uri.fsPath || result.uri.path);
  const items = [];

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    const previewMatch = previewMatches[index] || previewMatches[0];
    const line = range.start.line + 1;
    const column = range.start.character + 1;
    let detail = result.preview.text.trim();

    if (previewMatch) {
      detail = result.preview.text.slice(0).trim();
    }

    items.push({
      label: basename,
      description: `${relativePath}:${line}:${column}`,
      detail,
      location: {
        uri: result.uri,
        range
      }
    });
  }

  return items;
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
