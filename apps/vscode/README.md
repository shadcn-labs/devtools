# Shadcn Labs for VS Code

One extension for every [Shadcn Labs](https://github.com/shadcn-labs) registry — [ogimagecn](https://ogimagecn.com), [shadercn](https://shadercn.run), [pdfcn](https://pdfcn.dev), [termcn](https://termcn.dev) and [shadcn-cssinjs](https://shadcn-cssinjs.com). Works in VS Code, Cursor, Windsurf, Trae, Antigravity and any editor that installs from Open VSX.

## Features

- **Registries view** — the Shadcn Labs icon in the activity bar opens a searchable catalog of every registry. Install an item into the current project or copy its `shadcn add` command.
- **Add Registry Item…** — a command-palette quick pick over all registries. Installing registers the registry in `components.json` (when present) and runs `shadcn add` with your package manager in a "Shadcn Labs" terminal.
- **Browser toolbar bridge** — a local bridge lets the Shadcn Labs toolbar in your running app install items and jump to source, e.g. open the `opengraph-image.tsx` that renders the current page's Open Graph image. The status bar shows the bridge port; click it for details.

## Set up the browser toolbar

Run **Shadcn Labs: Set Up Browser Toolbar** from the command palette, or in your project:

```sh
npx @shadcn-labs/devtools init
```

Restart your dev server, open the app and press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> to toggle the toolbar. It connects to this editor automatically.

## Commands

| Command                                 |                                                        |
| --------------------------------------- | ------------------------------------------------------ |
| Shadcn Labs: Add Registry Item…         | Search all registries and install an item              |
| Shadcn Labs: Set Up Browser Toolbar     | Run `@shadcn-labs/devtools init` in a workspace folder |
| Shadcn Labs: Restart Toolbar Bridge     | Restart the local bridge                               |
| Shadcn Labs: Refresh Registries         | Reload registry indexes                                |
| Shadcn Labs: Show Toolbar Bridge Status | Ports, served folders and errors                       |

## Settings

| Setting                            | Default |                                                                                  |
| ---------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `shadcnLabs.bridge.enabled`        | `true`  | Run the toolbar bridge                                                           |
| `shadcnLabs.bridge.allowedOrigins` | `[]`    | Extra dev-server origins (e.g. `http://app.test:3000`) allowed to use the bridge |

## Security

The bridge listens on `127.0.0.1` only (first free port of 5747–5756), one per workspace folder with a `package.json`. It accepts requests from `localhost`, `127.0.0.1`, `[::1]` and `*.localhost` pages plus the origins you list in `shadcnLabs.bridge.allowedOrigins`, and every request must carry a custom header that forces a CORS preflight. It can only run `shadcn add` for Shadcn Labs registry items and open files inside the workspace. Turn it off with `shadcnLabs.bridge.enabled`.
