const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const htmlPath = path.join(__dirname, "../index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let checked = 0;
let match;

while ((match = scriptPattern.exec(html)) !== null) {
  const attributes = match[1] || "";
  const source = match[2] || "";
  if (!source.trim()) continue;
  if (/\bsrc\s*=/i.test(attributes)) continue;
  if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)) continue;
  if (/\btype\s*=\s*["']module["']/i.test(attributes)) continue;

  new vm.Script(source, { filename: "index.html:inline-script-" + (checked + 1) });
  checked += 1;
}

if (checked === 0) {
  throw new Error("No se encontró ningún script incrustado para comprobar.");
}
process.stdout.write("Sintaxis válida: " + checked + " script(s) incrustado(s).\n");
