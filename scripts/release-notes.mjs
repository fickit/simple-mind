import { readFileSync } from "node:fs";

/**
 * Prints the CHANGELOG section for one release.
 *
 * @param version Release version, with or without a leading v.
 */
function releaseNotes(version) {
  const tag = version.replace(/^v/, "");
  const lines = readFileSync("CHANGELOG.md", "utf8").split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## ${tag}`));
  if (start < 0) throw new Error(`No CHANGELOG section for ${tag}`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }

  const body = lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
  if (!body) throw new Error(`Empty CHANGELOG section for ${tag}`);
  return body;
}

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/release-notes.mjs <version>");
  process.exit(1);
}

try {
  process.stdout.write(`${releaseNotes(version)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
