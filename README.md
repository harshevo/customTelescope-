# CustomTelescope

CustomTelescope brings a small Telescope-like workflow to VS Code. It opens definitions, implementations, and references for the symbol under your cursor in a quick-pick list, so you can jump through results without using the full peek or references panel.

It is especially handy with `VSCodeVim`, but it works fine without Vim too.

## Features

- Quick-pick definitions for the symbol under the cursor
- Quick-pick implementations for the symbol under the cursor
- Quick-pick references for the symbol under the cursor
- Quick Search for the current word under the cursor across the workspace
- Works nicely with leader-based keybindings in `VSCodeVim`

## Commands

- `CustomTelescope: Find Definitions`
- `CustomTelescope: Find Implementations`
- `CustomTelescope: Find References`
- `CustomTelescope: Find Current Word In Workspace`

## Installation

### From the Marketplace

Search for `CustomTelescope` in the VS Code Extensions view and install it.

### From a VSIX

If you have a packaged `.vsix`:

1. Open the Extensions view in VS Code.
2. Click the `...` menu in the top-right.
3. Choose `Install from VSIX...`
4. Select the `.vsix` file.

### From source

1. Clone this repository.
2. Package it with:

```bash
npx @vscode/vsce package
```

3. Install the generated `.vsix` file.

## How To Use

1. Open a file in VS Code.
2. Put your cursor on a symbol.
3. Run one of the commands:
   - find definitions
   - find implementations
   - find references
   - find current word in workspace
4. Pick a result from the quick-pick list.
5. Press `Enter` to open it.

## Example VSCodeVim keybindings

Add this to your VS Code `settings.json`:

```json
{
  "vim.leader": "<space>",
  "vim.normalModeKeyBindings": [
    {
      "before": ["<leader>", "f", "d"],
      "commands": ["customTelescope.findDefinitions"]
    },
    {
      "before": ["<leader>", "f", "i"],
      "commands": ["customTelescope.findImplementations"]
    },
    {
      "before": ["<leader>", "f", "r"],
      "commands": ["customTelescope.findReferences"]
    },
    {
      "before": ["<leader>", "f", "w"],
      "commands": ["customTelescope.findWordInWorkspace"]
    }
  ]
}
```

## Quick-pick navigation

If you want `Ctrl + j` and `Ctrl + k` to move through quick-pick results, add this to your `keybindings.json`:

```json
[
  {
    "key": "ctrl+j",
    "command": "workbench.action.quickOpenSelectNext",
    "when": "inQuickOpen"
  },
  {
    "key": "ctrl+k",
    "command": "workbench.action.quickOpenSelectPrevious",
    "when": "inQuickOpen"
  }
]
```

## Notes

This extension depends on language support already present in VS Code. If a language server does not provide definitions, implementations, or references for a file type, CustomTelescope cannot invent them.
