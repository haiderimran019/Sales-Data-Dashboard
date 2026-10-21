import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "../data/processed/superstore_clean.csv");
const destination = resolve(root, "public/data/superstore_clean.csv");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
