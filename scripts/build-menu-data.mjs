import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outPath = path.join(rootDir, "src", "_data", "menu.json");

function logInfo(message) {
  console.log(`[menu-data] ${message}`);
}

function logWarn(message) {
  console.warn(`[menu-data] ${message}`);
}

function fail(message) {
  throw new Error(`[menu-data] ${message}`);
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalKey(header) {
  const key = normalizeHeader(header);

  if (["category", "section", "group"].includes(key)) return "category";
  if (["name", "item", "item_name", "title"].includes(key)) return "name";
  if (["description", "details", "notes"].includes(key)) return "description";
  if (["price", "cost"].includes(key)) return "price";
  if (["sort", "order", "position", "rank"].includes(key)) return "sort";
  if (["available", "availability", "active"].includes(key)) return "available";

  return key;
}

function isRowEmpty(row) {
  return row.every((cell) => String(cell || "").trim() === "");
}

function toBoolean(value, rowNumber) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return true;
  if (["true", "yes", "1", "y"].includes(normalized)) return true;
  if (["false", "no", "0", "n"].includes(normalized)) return false;
  fail(`Invalid available value "${value}" at row ${rowNumber}. Use true/false, yes/no, or 1/0.`);
}

function toSort(value, rowNumber) {
  const normalized = String(value || "").trim();
  if (!normalized) return Number.MAX_SAFE_INTEGER;

  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed)) {
    fail(`Invalid sort value "${value}" at row ${rowNumber}. Expected an integer.`);
  }

  return parsed;
}

function parseCsv(rawCsv) {
  try {
    return parse(rawCsv, {
      bom: true,
      skip_empty_lines: false,
      relax_column_count: true
    });
  } catch (error) {
    fail(`CSV parse failed: ${error.message}`);
  }
}

function startsWithAsciiLetter(value) {
  return /^[A-Za-z]/.test(String(value || "").trim());
}

function compareAlphaFirst(a, b) {
  const aText = String(a || "").trim();
  const bText = String(b || "").trim();
  const aIsAlpha = startsWithAsciiLetter(aText);
  const bIsAlpha = startsWithAsciiLetter(bText);

  if (aIsAlpha !== bIsAlpha) {
    return aIsAlpha ? -1 : 1;
  }

  return aText.localeCompare(bText, "en", {
    sensitivity: "base",
    numeric: true
  });
}

function buildMenu(rows, sourceLabel) {
  if (!rows.length) {
    fail("CSV is empty.");
  }

  const headerIndex = rows.findIndex((row) => !isRowEmpty(row));
  if (headerIndex === -1) {
    fail("CSV contains only empty rows.");
  }

  const headerRowNumber = headerIndex + 1;
  const headers = rows[headerIndex].map((value) => canonicalKey(value));

  if (!headers.includes("category")) {
    fail(`Missing required column "category" in header row ${headerRowNumber}.`);
  }
  if (!headers.includes("name")) {
    fail(`Missing required column "name" (or item/title alias) in header row ${headerRowNumber}.`);
  }

  const items = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 1;

    if (isRowEmpty(row)) {
      continue;
    }

    if (row.length > headers.length) {
      const extraCells = row.slice(headers.length).filter((cell) => String(cell || "").trim() !== "");
      if (extraCells.length > 0) {
        fail(`Row ${rowNumber} has ${row.length} columns, but header has ${headers.length}.`);
      }
    }

    const record = {};
    headers.forEach((key, index) => {
      record[key] = String(row[index] || "").trim();
    });

    if (!record.category) {
      fail(`Missing category at row ${rowNumber}.`);
    }
    if (!record.name) {
      fail(`Missing name at row ${rowNumber}.`);
    }

    const menuItem = {
      category: record.category,
      name: record.name,
      description: record.description || "",
      price: record.price || "",
      sort: toSort(record.sort, rowNumber),
      available: toBoolean(record.available, rowNumber)
    };

    if (menuItem.available) {
      items.push(menuItem);
    }
  }

  const sectionsByName = new Map();

  for (const item of items) {
    if (!sectionsByName.has(item.category)) {
      sectionsByName.set(item.category, []);
    }
    sectionsByName.get(item.category).push(item);
  }

  const sections = [...sectionsByName.entries()]
    .map(([name, sectionItems]) => ({
      name,
      items: sectionItems
        .sort((a, b) => {
          if (a.sort !== b.sort) return a.sort - b.sort;
          return compareAlphaFirst(a.name, b.name);
        })
        .map(({ sort, ...item }) => item)
    }))
    .sort((a, b) => compareAlphaFirst(a.name, b.name));

  if (!sections.length) {
    logWarn("No available menu items found after normalization. Generating an empty menu payload.");
  }

  return {
    source: sourceLabel,
    generatedAt: new Date().toISOString(),
    sections
  };
}

async function fetchCsv(url) {
  logInfo(`Fetching CSV from URL: ${url}`);

  const response = await fetch(url, {
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    fail(`Failed to fetch CSV (${response.status} ${response.statusText}) from ${url}`);
  }

  const csvText = await response.text();
  if (!csvText.trim()) {
    fail("Fetched CSV is empty.");
  }

  return csvText;
}

async function readCsvFromFile(relativeOrAbsolutePath) {
  const resolvedPath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(rootDir, relativeOrAbsolutePath);

  logInfo(`Reading CSV from file: ${resolvedPath}`);

  try {
    const csvText = await readFile(resolvedPath, "utf8");
    if (!csvText.trim()) {
      fail(`CSV file is empty: ${resolvedPath}`);
    }
    return { csvText, resolvedPath };
  } catch (error) {
    fail(`Could not read CSV file ${resolvedPath}: ${error.message}`);
  }
}

async function main() {
  const sourceUrl = process.env.MENU_CSV_URL;
  const sourceFile = process.env.MENU_CSV_FILE;

  if (!sourceUrl && !sourceFile) {
    fail(
      "Set MENU_CSV_URL to a public Google Sheets CSV export URL (or MENU_CSV_FILE for local/offline testing)."
    );
  }

  let csvText;
  let sourceLabel;

  if (sourceUrl) {
    if (!sourceUrl.includes("docs.google.com/spreadsheets")) {
      fail("MENU_CSV_URL must point to a Google Sheets CSV export URL.");
    }

    csvText = await fetchCsv(sourceUrl);
    sourceLabel = sourceUrl;
  } else {
    const fileResult = await readCsvFromFile(sourceFile);
    csvText = fileResult.csvText;
    sourceLabel = fileResult.resolvedPath;
  }

  const rows = parseCsv(csvText);
  const menu = buildMenu(rows, sourceLabel);

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(menu, null, 2)}\n`, "utf8");
  logInfo(`Wrote ${menu.sections.length} sections to ${outPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
