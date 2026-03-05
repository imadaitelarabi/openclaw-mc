#!/usr/bin/env node
// Copies package.json into dist/ so the compiled server can read its own version
// at runtime without depending on NODE_ENV or the project root being in the path.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../package.json");
const distDir = path.join(__dirname, "../dist");
const dest = path.join(distDir, "package.json");

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied package.json → dist/package.json`);
