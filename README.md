# Sheets Menu (11ty)

Static restaurant menu site built with Eleventy and fed by Google Sheets CSV.

## Requirements

- Node.js `22.19.0` (see `.nvmrc` and `.node-version`)
- npm

## Setup (Windows PowerShell)

```powershell
npm install
$env:MENU_CSV_URL="https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=Menu"
npm run dev
```

## Build

```powershell
$env:MENU_CSV_URL="https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=Menu"
npm run build
```

## Validate fail-loud malformed CSV handling

```powershell
npm run validate:data
```

## Offline/local CSV testing

```powershell
$env:MENU_CSV_FILE="src/_data/menu.sample.csv"
npm run build
```

## Data pipeline

1. `scripts/build-menu-data.mjs` fetches the CSV from Google Sheets.
2. CSV is parsed and normalized defensively.
3. Malformed CSV/data fails loudly with row-level errors where possible.
4. Output is written to `src/_data/menu.json`.
5. Templates render normalized JSON only.

## Notes

- Edit source files in `src/`; do not edit generated files in `_site/`.
- For GitHub Pages project sites, asset URLs are path-prefix safe.

## GitHub Pages deploy

Workflow: `.github/workflows/deploy-pages.yml`

- Runs on push to `main`
- Requires repository secret `MENU_CSV_URL`
- Fails fast if required secret is missing
- Runs malformed-CSV validation before build
- Builds `_site` and deploys to GitHub Pages
