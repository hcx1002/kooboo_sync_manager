# Kooboo Site Development Guide

This directory is a local Kooboo site workspace synchronized by Kooboo Sync Manager. Treat it as source-controlled site code and keep edits scoped to the module you are working on.

## Project Layout

- `Page/`: Kooboo pages, usually HTML templates.
- `View/`: reusable Kooboo views and partial templates.
- `Layout/`: shared page layouts.
- `Api/`: Kooboo API code, usually TypeScript.
- `Code/`: shared Kooboo code blocks, usually TypeScript.
- `Script/`: JavaScript assets managed by Kooboo.
- `Style/`: CSS assets managed by Kooboo.
- `Label/labels.json`: localization labels.
- `Site/config.json`: site settings pulled from Kooboo.
- `uno.config.ts`: local UnoCSS editor IntelliSense config generated from `Site/config.json` when site settings are synchronized.
- `types.kooboo.d.ts` and `kooboo.project.d.ts`: local type hints for Kooboo runtime APIs.

## Editing Rules

- Do not casually edit `__metadata.json` for unrelated changes.
- You may edit `__metadata.json` when the task creates, deletes, renames, or reroutes Kooboo items such as `Api`, `Page`, `View`, `Layout`, `Code`, `Script`, or `Style`.
- When adding a new local Kooboo item, create both the module file and its metadata entry. Use `00000000-0000-0000-0000-000000000000` as the id for new items that should be created remotely on push.
- When deleting or renaming a Kooboo item, keep the local file and metadata entry in sync.
- Do not delete module directories just because they are empty; the sync workflow expects the configured module folders to exist.
- Keep Kooboo item names, routes, and filenames stable unless the requested change explicitly requires a rename.
- For `Api` and `Page` entries, preserve route fields in metadata when changing files.
- For new or changed `Api` and `Page` entries, ensure `url` or `path` values are present and do not collide with existing routes.
- Do not store secrets in source files. Environment credentials belong in the Sync Manager environment configuration, not in this workspace.

## UnoCSS

- Use `uno.config.ts` for local utility-class IntelliSense.
- Kooboo's authoritative UnoCSS configuration lives in `Site/config.json` under `unocssSettings.config`.
- `Site/config.json` may be edited when the task is about site settings. This includes updating `unocssSettings.config` for UnoCSS theme, shortcuts, safelist, or rules.
- `uno.config.ts` is a generated local helper for editor IntelliSense. Do not treat it as the authoritative source for Kooboo site settings.
- The Sync Manager refreshes `uno.config.ts` automatically when pulling or pushing site settings.
- Prefer existing shortcuts, colors, and breakpoints from `uno.config.ts` over inventing new one-off utilities.

## TypeScript And Kooboo Runtime

- Kooboo runtime globals are described by `types.kooboo.d.ts` and `kooboo.project.d.ts`.
- Avoid importing Node-only modules in Kooboo runtime code unless the target runtime explicitly supports them.
- Keep shared helper code in `Code/` when it is intended to be reused by multiple APIs/pages.
- Validate API route/path changes against existing `Api` and `Page` routes to avoid collisions.

## Sync Safety

- Pull may overwrite local files with remote content. Push may update remote Kooboo content.
- Before force pull or force push, check for uncommitted local changes.
- If local files were added or removed manually, run the Sync Manager repair action before pushing.
