import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { minify } from "minify";

const DATA_FILE = "./data/accounts.json";
const TEMPLATE_FILE = "./src/site/template.html";
const OUTPUT_DIR = "./dist";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "index.html");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// deal with the accounts json data
console.log("reading ", DATA_FILE);
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const allowedKeys = ["did", "handle", "pds", "followersCount"] as const;
type AllowedKey = typeof allowedKeys[number];
const jsonData = data
  .map((item: Record<string, any>) => {
    const filtered: Partial<Record<AllowedKey, any>> = {};
    allowedKeys.forEach((key) => {
    if (key in item) {
      filtered[key] = item[key];
    }
  });
  return filtered;
});
const jsonString = JSON.stringify(jsonData);
const hash = createHash("sha256").update(jsonString).digest("hex").substring(0, 8);
const dataFileName = `data-${hash}.json`;
const dataFilePath = path.join(OUTPUT_DIR, dataFileName);
fs.writeFileSync(dataFilePath, jsonString);

// do the website thing
console.log("reading ", TEMPLATE_FILE);
let htmlTemplate = fs.readFileSync(TEMPLATE_FILE, "utf8");
htmlTemplate = htmlTemplate.replace("__DATA_FILENAME__", dataFileName);
const minifiedHtml = await minify.html(htmlTemplate);
fs.writeFileSync(OUTPUT_FILE, minifiedHtml);
console.log(`built successfully; written to ${OUTPUT_FILE}`);
