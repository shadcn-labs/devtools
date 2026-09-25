# Shadcn Labs Devtools

One toolbar, one editor extension and one CLI for every Shadcn Labs registry: [ogimagecn](https://ogimagecn.com), [shadercn](https://shadercn.run), [pdfcn](https://pdfcn.dev), [termcn](https://termcn.dev) and [shadcn-cssinjs](https://shadcn-cssinjs.com).

- **Browser toolbar**: a dev-only overlay in your running app. Search and install items from every registry. Project plugins add their own tabs; the ogimagecn plugin audits the current page's Open Graph tags and previews the card on X, LinkedIn, Slack, Discord and Facebook.
- **Editor extension**: a Registries view and an "Add Registry Item…" command for VS Code, Cursor, Windsurf, Trae and Antigravity. It also runs the local bridge the toolbar uses to install items and open source files.
- **CLI**: `npx @shadcn-labs/devtools <init|add|search|bridge>`.

## Quick start

```sh
npx @shadcn-labs/devtools init
```

`init` detects your framework and wires the toolbar in:

| Framework          | What `init` does                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Next.js App Router | Installs `@shadcn-labs/devtools-next`, adds `<ShadcnLabsDevtools />` before `</body>` in the root layout |
| Vite SPA           | Installs `@shadcn-labs/devtools-vite`, adds `shadcnLabsDevtools()` to `plugins` in `vite.config.*`       |
| Anything else      | Prints the manual steps: mount `@shadcn-labs/devtools-toolbar` from a client entry in development        |

Start your dev server and press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>. To install items and jump to source from the toolbar, install the **Shadcn Labs** editor extension (`shadcn-labs.shadcn-labs-devtools`) or run `npx @shadcn-labs/devtools bridge` in the project. The toolbar never ships in production builds.

## CLI

```sh
npx @shadcn-labs/devtools add @ogimagecn/blog @termcn/ink/spinner   # registers the registries in components.json, then runs shadcn add
npx @shadcn-labs/devtools search spinner --registry termcn --json
npx @shadcn-labs/devtools bridge                                    # toolbar bridge for editors without the extension
```

`bridge` opens files with `$SHADCN_LABS_EDITOR`, `$VISUAL` or `$EDITOR`, and falls back to the OS opener.

## Packages

| Package                                  | Path                         |                                                                                                                                         |
| ---------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@shadcn-labs/devtools-plugin-api`       | `packages/plugin-api`        | Plugin contract, `ProjectInfo` and the bridge protocol. Versioned with strict semver                                                    |
| `@shadcn-labs/devtools-core`             | `packages/core`              | Registry catalog, search, `shadcn add` commands; `/node`: project detection, `components.json` registries, Next.js OG source resolution |
| `@shadcn-labs/devtools-bridge`           | `packages/bridge`            | Localhost HTTP bridge: `/server` for hosts, `/client` for the toolbar                                                                   |
| `@shadcn-labs/devtools-toolbar`          | `packages/toolbar`           | `mountToolbar()` and `mountRegistryBrowser()` (also used by the extension's webview)                                                    |
| `@shadcn-labs/devtools-plugin-ogimagecn` | `packages/plugins/ogimagecn` | OG Image tab: meta audit, card previews, open source                                                                                    |
| `@shadcn-labs/devtools-next`             | `packages/next`              | `<ShadcnLabsDevtools />` server component                                                                                               |
| `@shadcn-labs/devtools-vite`             | `packages/vite`              | `shadcnLabsDevtools()` Vite plugin                                                                                                      |
| `@shadcn-labs/devtools`                  | `packages/cli`               | CLI                                                                                                                                     |
| `shadcn-labs-devtools`                   | `apps/vscode`                | Editor extension (VS Code Marketplace + Open VSX)                                                                                       |
| `playground-next`, `playground-vite`     | `apps/playground-*`          | Dev playgrounds with the toolbar wired in                                                                                               |

## Adding a project plugin

A plugin is a `DevtoolsPlugin` from `@shadcn-labs/devtools-plugin-api`:

```ts
import { definePlugin } from "@shadcn-labs/devtools-plugin-api";

export const shadercnPlugin = definePlugin({
  detect: (project) => "@shadercn" in project.registries,
  id: "shadercn",
  name: "shadercn",
  scope: "@shadercn",
  toolbar: {
    icon: "<svg …/>",
    mount(container, ctx) {
      // Render into the toolbar's shadow root. Style with the --sl-* variables.
      // ctx: project, bridge, copy, notify, onNavigate.
      return () => {};
    },
  },
});
```

1. Create `packages/plugins/<id>`. Depend only on `plugin-api` and `core`, and on the project's published npm package if you need one. Never import from the project's repo.
2. Add the plugin to `BUILTIN_PLUGINS` in `packages/toolbar/src/toolbar.ts`.
3. If the plugin needs the editor, add a request type to `BridgeRequest` in `plugin-api` and handle it in `handleBridgeRequest` in `packages/bridge/src/server.ts`. That one handler serves the extension and the CLI bridge.

Registries without a plugin still show up in the Registries tab. A new registry only needs an entry in `LABS_REGISTRIES` (`packages/core/src/registries.ts`).

## Bridge security

The bridge binds `127.0.0.1` only, on the first free port from 5747 to 5756. It accepts browser requests only from `localhost`, `127.0.0.1`, `[::1]` and `*.localhost` origins, plus any you configure. Every request must carry the `x-shadcn-labs-devtools` header, so cross-site pages can't reach it without a CORS preflight, which the bridge refuses. It runs `shadcn add` only for validated `@scope/name` refs from Labs registries, and it only opens files it resolved inside the workspace.

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm --filter playground-next dev                          # http://localhost:3100
pnpm --filter @shadcn-labs/devtools-toolbar demo           # toolbar demo on :5199
pnpm --filter shadcn-labs-devtools test                    # extension integration test (downloads VS Code once)
pnpm --filter shadcn-labs-devtools package                 # build the .vsix
```

## License

MIT
