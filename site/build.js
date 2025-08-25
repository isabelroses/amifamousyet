import fs from "fs";
import path from "path";
import { minify } from 'minify';

const DATA_FILE = "./dist/accounts.json";
const TEMPLATE_FILE = "./site/template.html";
const OUTPUT_DIR = "./dist";
const OUTPUT_FILE = path.join(OUTPUT_DIR, "index.html");

try {
  console.log("reading ", DATA_FILE);
  const rawData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  // filter to only include specific keys, saving some speed
  const allowedKeys = ["did", "handle", "pds", "followersCount"];
  const jsonData = rawData
  .map((item) => {
    const filtered = {};
    allowedKeys.forEach((key) => {
      if (item.hasOwnProperty(key)) {
        filtered[key] = item[key];
      }
    });

    // nuke 0 followers accounts, this massively speeds up webload speeds
    if (filtered.followersCount === 0) return null;

    return filtered;
  })
  .filter((item) => item !== null);

  console.log(
    `Loaded ${rawData.length} records, filtered to ${allowedKeys.length} keys per record`,
  );

  console.log("reading ", TEMPLATE_FILE);
  let htmlTemplate = fs.readFileSync(TEMPLATE_FILE, "utf8");

  const dataString = JSON.stringify(jsonData, null, 4);
  htmlTemplate = htmlTemplate.replace("__DATA_PLACEHOLDER__", dataString);

  const minifiedHtml = await minify.html(htmlTemplate);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, minifiedHtml);
  console.log(`built successfully; written to ${OUTPUT_FILE}`);
} catch (error) {
  console.error("build failed:", error.message);
  process.exit(1);
}
