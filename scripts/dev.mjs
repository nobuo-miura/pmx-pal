import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const electronCommand = process.platform === "win32" ? "electron.cmd" : "electron";

const vite = spawn(npmCommand, ["exec", "vite", "--", "--host", "127.0.0.1"], {
  stdio: "inherit",
});

async function waitForVite() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:5173");
      if (response.ok) return;
    } catch {
      // Viteの起動が完了するまで短時間待機します。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Viteの起動を確認できませんでした");
}

function stopVite() {
  if (!vite.killed) vite.kill("SIGTERM");
}

process.on("SIGINT", stopVite);
process.on("SIGTERM", stopVite);
process.on("exit", stopVite);

try {
  await waitForVite();
  const electron = spawn(electronCommand, ["dist-electron/main.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
    },
  });

  const exitCode = await new Promise((resolve) => {
    electron.on("exit", (code) => resolve(code ?? 0));
    electron.on("error", () => resolve(1));
  });
  stopVite();
  process.exitCode = exitCode;
} catch (error) {
  console.error(error);
  stopVite();
  process.exitCode = 1;
}
