import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");

const widgetSnippet = (profile) => `
  <script>
    window.JOHNNY_WIDGET_PROFILE = "${profile}";
  </script>
  <link rel="stylesheet" href="https://johnny-chat.onrender.com/voice-widget.css">
  <script src="https://johnny-chat.onrender.com/voice-widget.js"></script>`;

function insertBeforeBodyEnd(html, snippet) {
  if (html.includes("voice-widget.js")) return html;
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf("</body>");
  if (idx === -1) return `${html}\n${snippet}\n`;
  return `${html.slice(0, idx)}${snippet}\n${html.slice(idx)}`;
}

function createRootRedirectPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Johnny</title>
  <meta name="description" content="Johnny's websites and assistant demo.">
  <script>
    (function () {
      const host = String(window.location.hostname || "").toLowerCase();
      const target = host.includes("618help.com") ? "/help-mowing/" : "/chatbots/";
      if (window.location.pathname !== target) {
        window.location.replace(target);
      }
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0; url=/chatbots/">
  </noscript>
</head>
<body>
  <p>Redirecting...</p>
</body>
</html>`;
}

async function main() {
  const aiSourcePath = path.join(publicDir, "ai-services.html");
  const mowingSourcePath = path.join(root, "squarespace_landing_section.html");

  const [aiSource, mowingSource] = await Promise.all([
    readFile(aiSourcePath, "utf8"),
    readFile(mowingSourcePath, "utf8")
  ]);

  const aiClean = aiSource.replace(/<\/html>\s*[\s\S]*$/i, "</html>");
  const aiWithWidget = insertBeforeBodyEnd(aiClean, widgetSnippet("ai"));

  await mkdir(path.join(publicDir, "chatbots"), { recursive: true });
  await mkdir(path.join(publicDir, "help-mowing"), { recursive: true });

  await writeFile(path.join(publicDir, "chatbots", "index.html"), aiWithWidget, "utf8");

  const mowingHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>618help.com - Mowing</title>
  <meta name="description" content="Johnny's mowing service for the Mount Vernon area.">
</head>
<body>
${mowingSource}
${widgetSnippet("mowing")}
</body>
</html>`;

  await writeFile(path.join(publicDir, "help-mowing", "index.html"), mowingHtml, "utf8");
  await writeFile(path.join(publicDir, "index.html"), createRootRedirectPage(), "utf8");

  console.log("Pages build files generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
