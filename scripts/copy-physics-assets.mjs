import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceDirectory = path.resolve(
  "node_modules/@yohawing/three-mmd-loader/dist/physics/mmd",
);
const destinationDirectory = path.resolve("public/mmd");

await mkdir(destinationDirectory, { recursive: true });
await Promise.all(
  ["mmd_bullet.js", "mmd_bullet.wasm"].map((fileName) =>
    copyFile(path.join(sourceDirectory, fileName), path.join(destinationDirectory, fileName)),
  ),
);
