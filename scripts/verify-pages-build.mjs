#!/usr/bin/env node

import { access, lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicRoot = path.join(root, "public");
const maxFileSize = 25 * 1024 * 1024;
const activeRoutes = [
  "/glade/",
  "/first-ember/",
  "/mosswake/",
  "/cozy-builder-game/",
  "/cozy-builder/",
  "/crownforge/"
];
const errors = [];

function report(label, detail) {
  console.log(`PASS ${label} — ${detail}`);
}

function fail(label, detail) {
  errors.push(`${label}: ${detail}`);
  console.error(`FAIL ${label} — ${detail}`);
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(directory) {
  const files = [];
  if (!(await exists(directory))) return files;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(target));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

function routePath(route) {
  return path.join(publicRoot, route.replace(/^\/+/, ""), "index.html");
}

if (!(await exists(publicRoot))) fail("Pages build", "public/ directory is missing");

const homepagePath = path.join(publicRoot, "index.html");
if (!(await exists(homepagePath))) {
  fail("Homepage", "public/index.html is missing");
} else {
  const homepage = await readFile(homepagePath, "utf8");
  for (const route of activeRoutes) {
    if (!homepage.includes(`href="${route}"`) && route !== "/cozy-builder/") {
      fail("Homepage navigation", `missing active route ${route}`);
    }
  }
  report("Homepage navigation", "active public game routes are linked");
}

for (const route of activeRoutes) {
  if (!(await exists(routePath(route)))) fail("Route", `${route} is missing index.html`);
}
if (!errors.some((entry) => entry.startsWith("Route:"))) {
  report("Routes", `${activeRoutes.length} active game routes have index.html`);
}

const allFiles = await filesUnder(publicRoot);
const htmlFiles = allFiles.filter((file) => file.endsWith(".html"));
let retiredReference = false;
for (const file of htmlFiles) {
  const text = await readFile(file, "utf8");
  if (/href=["']\/settlement\//i.test(text) || /school life|bellweather academy/i.test(text)) {
    fail("Retired navigation", `reference found in ${path.relative(root, file)}`);
    retiredReference = true;
  }
}
if (!retiredReference) report("Retired navigation", "School Life and /settlement/ are absent from HTML navigation");

const retiredRoute = path.join(publicRoot, "settlement", "index.html");
if (await exists(retiredRoute)) {
  const text = await readFile(retiredRoute, "utf8");
  if (/hearthwild/i.test(text) || !/location\.replace\(["']\/["']\)/.test(text)) {
    fail("Retired route", "settlement route is not a clean homepage redirect");
  } else {
    report("Retired route", "settlement route is a Hearthwild-free homepage redirect");
  }
}

const oversized = [];
for (const file of allFiles) {
  const size = (await lstat(file)).size;
  if (size > maxFileSize) oversized.push(`${path.relative(root, file)} (${(size / 1024 / 1024).toFixed(1)} MiB)`);
}
if (oversized.length) {
  fail("Pages file limit", `files exceed 25 MiB: ${oversized.join(", ")}`);
} else {
  report("Pages file limit", "no public file exceeds 25 MiB");
}

if (errors.length) {
  console.error(`\nPages build verification failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
  process.exitCode = 1;
} else {
  console.log("\nPages build verification passed.");
}
