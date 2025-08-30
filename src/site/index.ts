import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { minify } from "minify";

const DATA_FILE = "./data/accounts.json";
const TEMPLATE_DIR = "./src/site";
const OUTPUT_DIR = "./dist";

function hashFileName(filename: string, str: any): string {
  const hash = createHash("sha256").update(str).digest("hex").substring(0, 8);
  const dataFileName = `${filename}-${hash}.json`;
  const dataFilePath = path.join(OUTPUT_DIR, dataFileName);
  fs.writeFileSync(dataFilePath, str);
  console.log(`written data file to ${dataFilePath}`);
  return dataFileName;
}

async function writeNoneStaticFile(filename: string, json_file: string) {
  const inFilePath = path.join(TEMPLATE_DIR, `${filename}_template.html`);
  const outFilePath = path.join(OUTPUT_DIR, `${filename}.html`);

  console.log("reading ", inFilePath);
  let htmlTemplate = fs.readFileSync(inFilePath, "utf8");
  htmlTemplate = htmlTemplate.replace("__DATA_FILENAME__", json_file);
  const minifiedHtml = await minify.html(htmlTemplate);
  fs.writeFileSync(outFilePath, minifiedHtml);
  console.log(`built successfully; written to ${outFilePath}`);
}

function copyStaticFile(src: string, dest: string) {
  fs.copyFile(src, dest, (err) => {
    if (err) {
      console.error(`Error copying ${src}:`, err);
    } else {
      console.log(`${src} copied successfully to ${dest}.`);
    }
  });
}

/// main script

// prepare the output dir
if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// deal with the accounts json data
console.log("reading ", DATA_FILE);
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const allowedKeys = ["did", "handle", "pds", "followersCount"] as const;
type AllowedKey = (typeof allowedKeys)[number];
const jsonData = data.map((item: Record<string, any>) => {
  const filtered: Partial<Record<AllowedKey, any>> = {};
  allowedKeys.forEach((key) => {
    if (key in item) {
      filtered[key] = item[key];
    }
  });
  return filtered;
});
const jsonString = JSON.stringify(jsonData);
const accounts_json_file = hashFileName("accounts", jsonString);
await writeNoneStaticFile("accounts", accounts_json_file);

// now do the pdses json data
const pdsesJson = fs.readFileSync("./data/pdses.json", "utf-8");
const pdses_json_file = hashFileName("pdses", pdsesJson);
await writeNoneStaticFile("pdses", pdses_json_file);

// copy the static files
copyStaticFile(
  TEMPLATE_DIR + "/styles.css",
  path.join(OUTPUT_DIR, "styles.css"),
);
copyStaticFile(
  TEMPLATE_DIR + "/index.html",
  path.join(OUTPUT_DIR, "index.html"),
);
