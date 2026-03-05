#!/usr/bin/env node
// Validates that dist/package.json exists and contains a version field.
// Used as a CI smoke-test to catch regressions where the build step fails
// to copy package.json into dist/, which would cause the server to crash on
// startup with: Cannot find module '.../dist/package.json'
const path = require("path");
const pkgPath = path.join(__dirname, "../dist/package.json");

let pkg;
try {
  pkg = require(pkgPath);
} catch (err) {
  const isNotFound = err && err.code === "MODULE_NOT_FOUND";
  const hint = isNotFound
    ? "File not found. Run 'npm run build:server' to generate dist/package.json."
    : "File exists but could not be parsed. Check that dist/package.json is valid JSON.";
  console.error(
    `ERROR: Could not load ${pkgPath}\n${err instanceof Error ? err.message : err}\n\n${hint}`
  );
  process.exit(1);
}

if (!pkg.version) {
  console.error("ERROR: dist/package.json is missing the 'version' field.");
  process.exit(1);
}

console.log(`OK: dist/package.json version = ${pkg.version}`);
