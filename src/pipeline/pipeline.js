import { parseHtml } from "./parser.js";
import { sanitize } from "./sanitize.js";
import { repairLists } from "./listRepair.js";
import { fixImages } from "./images.js";
import { formatOutput } from "./format.js";

export function runPipeline(input) {
  let doc = parseHtml(input);
  doc = sanitize(doc);
  doc = repairLists(doc);
  doc = fixImages(doc);
  return formatOutput(doc);
}
