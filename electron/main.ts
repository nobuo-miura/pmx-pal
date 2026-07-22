import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  screen,
  type MenuItemConstructorOptions,
} from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isPathInside } from "./path-utils.js";

type InteractionMode = "move" | "rotate" | "fixed";
type GazeMode = "none" | "camera" | "cursor";

type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

type AppSettings = {
  modelPath?: string;
  motionPaths?: string[];
  /** 0.1.0で保存された単一モーション設定との互換用 */
  motionPath?: string;
  alwaysOnTop: boolean;
  interactionMode: InteractionMode;
  gazeMode: GazeMode;
  physicsEnabled: boolean;
  /** 0.1.0で保存された固定設定との互換用 */
  interactionLocked?: boolean;
  idleMotion: boolean;
  cameraStates?: Record<string, CameraState>;
  bounds?: Electron.Rectangle;
};

const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: true,
  interactionMode: "move",
  gazeMode: "none",
  physicsEnabled: true,
  idleMotion: true,
};

let mainWindow: BrowserWindow | null = null;
const activeAssetDirectories = new Map<string, string>();
let settings: AppSettings = { ...DEFAULT_SETTINGS };
let windowDragStart: { cursor: Electron.Point; bounds: Electron.Rectangle } | null = null;
let windowResizeStart: { cursor: Electron.Point; bounds: Electron.Rectangle } | null = null;
let cursorTrackingTimer: NodeJS.Timeout | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "pmxpal",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const saved = JSON.parse(raw) as Partial<AppSettings>;
    return {
      alwaysOnTop: saved.alwaysOnTop ?? true,
      interactionMode:
        saved.interactionMode === "move" ||
        saved.interactionMode === "rotate" ||
        saved.interactionMode === "fixed"
          ? saved.interactionMode
          : saved.interactionLocked === false
            ? "rotate"
            : "move",
      gazeMode:
        saved.gazeMode === "camera" || saved.gazeMode === "cursor" ? saved.gazeMode : "none",
      physicsEnabled: saved.physicsEnabled ?? true,
      idleMotion: saved.idleMotion ?? true,
      modelPath: saved.modelPath,
      motionPaths: saved.motionPaths ?? (saved.motionPath ? [saved.motionPath] : []),
      cameraStates: saved.cameraStates ?? {},
      bounds: saved.bounds,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function assetUrl(kind: "model" | "motion", filePath: string, index = 0): string {
  const assetKey = kind === "model" ? kind : `${kind}-${index}`;
  activeAssetDirectories.set(assetKey, path.dirname(filePath));
  const filename = path.basename(filePath)
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/");
  return `pmxpal://${assetKey}/${filename}`;
}

async function selectedModel(): Promise<{ url: string; name: string } | null> {
  if (!settings.modelPath) return null;

  try {
    const stat = await fs.stat(settings.modelPath);
    if (!stat.isFile()) return null;
    return {
      url: assetUrl("model", settings.modelPath),
      name: path.basename(settings.modelPath),
    };
  } catch {
    return null;
  }
}

async function selectedMotions(): Promise<Array<{ url: string; name: string }>> {
  const motionPaths = settings.motionPaths ?? [];
  const motions = await Promise.all(
    motionPaths.map(async (motionPath, index) => {
      try {
        const stat = await fs.stat(motionPath);
        if (!stat.isFile()) return null;
        return {
          url: assetUrl("motion", motionPath, index),
          name: path.basename(motionPath),
        };
      } catch {
        return null;
      }
    }),
  );
  return motions.filter((motion) => motion !== null);
}

function createWindow(): void {
  const display = screen.getPrimaryDisplay().workArea;
  const savedBounds = settings.bounds;
  const width = savedBounds?.width ?? 520;
  const height = savedBounds?.height ?? 720;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: savedBounds?.x ?? display.x + display.width - width - 24,
    y: savedBounds?.y ?? display.y + display.height - height - 24,
    minWidth: 300,
    minHeight: 400,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    titleBarStyle: "hidden",
    hasShadow: false,
    resizable: true,
    alwaysOnTop: settings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setWindowButtonVisibility(false);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedOrigin = devServerUrl ? new URL(devServerUrl).origin : "file://";
    if (!url.startsWith(allowedOrigin)) event.preventDefault();
  });

  const rememberBounds = (): void => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    settings.bounds = mainWindow.getBounds();
    void saveSettings();
  };

  mainWindow.on("move", rememberBounds);
  mainWindow.on("resize", rememberBounds);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startGlobalCursorTracking(): void {
  if (cursorTrackingTimer) clearInterval(cursorTrackingTimer);
  cursorTrackingTimer = setInterval(() => {
    if (settings.gazeMode !== "cursor" || !mainWindow || mainWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getContentBounds();
    mainWindow.webContents.send("cursor:global-position", {
      x: ((cursor.x - bounds.x) / Math.max(bounds.width, 1)) * 2 - 1,
      y: -((cursor.y - bounds.y) / Math.max(bounds.height, 1)) * 2 + 1,
    });
  }, 33);
  cursorTrackingTimer.unref();
}

function updateApplicationMenuChecks(): void {
  const menu = Menu.getApplicationMenu();
  const idleItem = menu?.getMenuItemById("idle-motion");
  const physicsItem = menu?.getMenuItemById("physics-enabled");
  const topItem = menu?.getMenuItemById("always-on-top");
  for (const mode of ["move", "rotate", "fixed"] as const) {
    const item = menu?.getMenuItemById(`interaction-mode-${mode}`);
    if (item) item.checked = settings.interactionMode === mode;
  }
  for (const mode of ["none", "camera", "cursor"] as const) {
    const item = menu?.getMenuItemById(`gaze-mode-${mode}`);
    if (item) item.checked = settings.gazeMode === mode;
  }
  if (idleItem) idleItem.checked = settings.idleMotion;
  if (physicsItem) physicsItem.checked = settings.physicsEnabled;
  if (topItem) topItem.checked = settings.alwaysOnTop;
}

async function setInteractionMode(value: InteractionMode): Promise<void> {
  settings.interactionMode = value;
  delete settings.interactionLocked;
  await saveSettings();
  updateApplicationMenuChecks();
  mainWindow?.webContents.send("interaction:mode-changed", value);
}

function interactionModeMenuItems(): MenuItemConstructorOptions[] {
  return [
    {
      id: "interaction-mode-move",
      label: "移動",
      type: "radio",
      checked: settings.interactionMode === "move",
      click: () => void setInteractionMode("move"),
    },
    {
      id: "interaction-mode-rotate",
      label: "回転・拡大縮小",
      type: "radio",
      checked: settings.interactionMode === "rotate",
      click: () => void setInteractionMode("rotate"),
    },
    {
      id: "interaction-mode-fixed",
      label: "固定",
      type: "radio",
      checked: settings.interactionMode === "fixed",
      click: () => void setInteractionMode("fixed"),
    },
  ];
}

async function setGazeMode(value: GazeMode): Promise<void> {
  settings.gazeMode = value;
  await saveSettings();
  updateApplicationMenuChecks();
  mainWindow?.webContents.send("gaze:mode-changed", value);
}

function gazeModeMenuItems(): MenuItemConstructorOptions[] {
  return [
    {
      id: "gaze-mode-none",
      label: "なし",
      type: "radio",
      checked: settings.gazeMode === "none",
      click: () => void setGazeMode("none"),
    },
    {
      id: "gaze-mode-camera",
      label: "カメラ目線",
      type: "radio",
      checked: settings.gazeMode === "camera",
      click: () => void setGazeMode("camera"),
    },
    {
      id: "gaze-mode-cursor",
      label: "マウスカーソル追従",
      type: "radio",
      checked: settings.gazeMode === "cursor",
      click: () => void setGazeMode("cursor"),
    },
  ];
}

async function setIdleMotion(value: boolean): Promise<void> {
  settings.idleMotion = value;
  await saveSettings();
  updateApplicationMenuChecks();
  mainWindow?.webContents.send("idle:enabled-changed", value);
}

async function setPhysicsEnabled(value: boolean): Promise<void> {
  settings.physicsEnabled = value;
  await saveSettings();
  updateApplicationMenuChecks();
  mainWindow?.webContents.send("physics:enabled-changed", value);
}

async function setAlwaysOnTop(value: boolean): Promise<void> {
  settings.alwaysOnTop = value;
  mainWindow?.setAlwaysOnTop(value, "floating");
  await saveSettings();
  updateApplicationMenuChecks();
  mainWindow?.webContents.send("window:always-on-top-changed", value);
}

function installApplicationMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          {
            label: "PMXモデルを開く…",
            accelerator: "CmdOrCtrl+O",
            click: () => mainWindow?.webContents.send("menu:open-model"),
          },
          {
            label: "待機VMDを選択…",
            accelerator: "CmdOrCtrl+Shift+O",
            click: () => mainWindow?.webContents.send("menu:open-motion"),
          },
          { type: "separator" },
          { label: "操作モード", submenu: interactionModeMenuItems() },
          { label: "目線モード", submenu: gazeModeMenuItems() },
          {
            id: "physics-enabled",
            label: "MMD物理演算",
            type: "checkbox",
            checked: settings.physicsEnabled,
            click: (item) => void setPhysicsEnabled(item.checked),
          },
          {
            id: "idle-motion",
            label: "待機モーション",
            type: "checkbox",
            checked: settings.idleMotion,
            click: (item) => void setIdleMotion(item.checked),
          },
          {
            id: "always-on-top",
            label: "常に手前に表示",
            type: "checkbox",
            checked: settings.alwaysOnTop,
            click: (item) => void setAlwaysOnTop(item.checked),
          },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "編集",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "ウインドウ",
        submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
      },
    ]),
  );
}

function registerIpc(): void {
  ipcMain.handle("model:open", async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "PMXモデルを選択",
      properties: ["openFile"],
      filters: [{ name: "MikuMikuDance PMX", extensions: ["pmx"] }],
    });

    const modelPath = result.filePaths[0];
    if (result.canceled || !modelPath) return null;

    settings.modelPath = modelPath;
    await saveSettings();
    return selectedModel();
  });

  ipcMain.handle("model:saved", selectedModel);

  ipcMain.handle("motion:open", async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "待機VMDを選択（複数選択できます）",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "MikuMikuDance VMD", extensions: ["vmd"] }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    settings.motionPaths = result.filePaths;
    delete settings.motionPath;
    await saveSettings();
    return selectedMotions();
  });

  ipcMain.handle("motion:saved", selectedMotions);

  ipcMain.handle("window:toggle-always-on-top", async () => {
    await setAlwaysOnTop(!settings.alwaysOnTop);
    return settings.alwaysOnTop;
  });

  ipcMain.handle("window:is-always-on-top", () => settings.alwaysOnTop);
  ipcMain.handle("interaction:set-mode", async (_event, mode: InteractionMode) => {
    if (mode !== "move" && mode !== "rotate" && mode !== "fixed") {
      return settings.interactionMode;
    }
    await setInteractionMode(mode);
    return settings.interactionMode;
  });
  ipcMain.handle("interaction:get-mode", () => settings.interactionMode);
  ipcMain.handle("gaze:set-mode", async (_event, mode: GazeMode) => {
    if (mode !== "none" && mode !== "camera" && mode !== "cursor") {
      return settings.gazeMode;
    }
    await setGazeMode(mode);
    return settings.gazeMode;
  });
  ipcMain.handle("gaze:get-mode", () => settings.gazeMode);
  ipcMain.handle("physics:toggle", async () => {
    await setPhysicsEnabled(!settings.physicsEnabled);
    return settings.physicsEnabled;
  });
  ipcMain.handle("physics:is-enabled", () => settings.physicsEnabled);
  ipcMain.handle("camera:get-state", () => {
    if (!settings.modelPath) return null;
    return settings.cameraStates?.[settings.modelPath] ?? null;
  });
  ipcMain.handle("camera:save-state", async (_event, state: CameraState) => {
    if (!settings.modelPath) return;
    const values = [...(state?.position ?? []), ...(state?.target ?? [])];
    if (
      state?.position?.length !== 3 ||
      state?.target?.length !== 3 ||
      !values.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      return;
    }
    settings.cameraStates ??= {};
    settings.cameraStates[settings.modelPath] = state;
    await saveSettings();
  });
  ipcMain.handle("idle:toggle", async () => {
    await setIdleMotion(!settings.idleMotion);
    return settings.idleMotion;
  });
  ipcMain.handle("idle:is-enabled", () => settings.idleMotion);
  ipcMain.on("window:close", () => mainWindow?.close());
  ipcMain.on("window:drag-start", () => {
    if (!mainWindow) return;
    windowResizeStart = null;
    windowDragStart = {
      cursor: screen.getCursorScreenPoint(),
      bounds: mainWindow.getBounds(),
    };
  });
  ipcMain.on("window:drag-update", () => {
    if (!mainWindow || !windowDragStart) return;
    const cursor = screen.getCursorScreenPoint();
    mainWindow.setPosition(
      windowDragStart.bounds.x + cursor.x - windowDragStart.cursor.x,
      windowDragStart.bounds.y + cursor.y - windowDragStart.cursor.y,
    );
  });
  ipcMain.on("window:drag-end", () => {
    windowDragStart = null;
  });
  ipcMain.on("window:resize-start", () => {
    if (!mainWindow) return;
    windowDragStart = null;
    windowResizeStart = {
      cursor: screen.getCursorScreenPoint(),
      bounds: mainWindow.getBounds(),
    };
  });
  ipcMain.on("window:resize-update", () => {
    if (!mainWindow || !windowResizeStart) return;
    const cursor = screen.getCursorScreenPoint();
    const width = Math.max(
      300,
      windowResizeStart.bounds.width + cursor.x - windowResizeStart.cursor.x,
    );
    const height = Math.max(
      400,
      windowResizeStart.bounds.height + cursor.y - windowResizeStart.cursor.y,
    );
    mainWindow.setSize(width, height);
  });
  ipcMain.on("window:resize-end", () => {
    windowResizeStart = null;
  });

  ipcMain.on("menu:show-interaction-mode", () => {
    if (!mainWindow) return;
    Menu.buildFromTemplate(interactionModeMenuItems()).popup({ window: mainWindow });
  });
  ipcMain.on("menu:show-gaze-mode", () => {
    if (!mainWindow) return;
    Menu.buildFromTemplate(gazeModeMenuItems()).popup({ window: mainWindow });
  });

  ipcMain.on("menu:show", () => {
    if (!mainWindow) return;
    Menu.buildFromTemplate([
      {
        label: "PMXモデルを開く…",
        click: () => mainWindow?.webContents.send("menu:open-model"),
      },
      {
        label: "待機VMDを選択…",
        click: () => mainWindow?.webContents.send("menu:open-motion"),
      },
      { type: "separator" },
      {
        label: "常に手前に表示",
        type: "checkbox",
        checked: settings.alwaysOnTop,
        click: async (item) => {
          await setAlwaysOnTop(item.checked);
        },
      },
      { label: "操作モード", submenu: interactionModeMenuItems() },
      { label: "目線モード", submenu: gazeModeMenuItems() },
      {
        label: "MMD物理演算",
        type: "checkbox",
        checked: settings.physicsEnabled,
        click: (item) => void setPhysicsEnabled(item.checked),
      },
      {
        label: "待機モーション",
        type: "checkbox",
        checked: settings.idleMotion,
        click: async (item) => {
          await setIdleMotion(item.checked);
        },
      },
      { type: "separator" },
      { label: "終了", role: "quit" },
    ]).popup({ window: mainWindow });
  });
}

app.whenReady().then(async () => {
  settings = await loadSettings();

  protocol.handle("pmxpal", async (request) => {
    const url = new URL(request.url);
    const assetDirectory =
      url.hostname === "app"
        ? path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? "../public/mmd" : "../dist/mmd")
        : activeAssetDirectories.get(url.hostname);
    if (!assetDirectory) return new Response("No asset selected", { status: 404 });

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const requestedPath = path.resolve(assetDirectory, relativePath);
    if (!isPathInside(assetDirectory, requestedPath)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      return await net.fetch(pathToFileURL(requestedPath).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  registerIpc();
  createWindow();
  startGlobalCursorTracking();
  installApplicationMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (cursorTrackingTimer) clearInterval(cursorTrackingTimer);
  cursorTrackingTimer = null;
});
