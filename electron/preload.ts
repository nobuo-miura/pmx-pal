import { contextBridge, ipcRenderer } from "electron";

export type ModelInfo = {
  url: string;
  name: string;
};

export type InteractionMode = "move" | "rotate" | "fixed";
export type GazeMode = "none" | "camera" | "cursor";

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

contextBridge.exposeInMainWorld("pmxPal", {
  openModel: (): Promise<ModelInfo | null> => ipcRenderer.invoke("model:open"),
  getSavedModel: (): Promise<ModelInfo | null> => ipcRenderer.invoke("model:saved"),
  openMotions: (): Promise<ModelInfo[] | null> => ipcRenderer.invoke("motion:open"),
  getSavedMotions: (): Promise<ModelInfo[]> => ipcRenderer.invoke("motion:saved"),
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke("window:toggle-always-on-top"),
  isAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke("window:is-always-on-top"),
  setInteractionMode: (mode: InteractionMode): Promise<InteractionMode> =>
    ipcRenderer.invoke("interaction:set-mode", mode),
  getInteractionMode: (): Promise<InteractionMode> => ipcRenderer.invoke("interaction:get-mode"),
  setGazeMode: (mode: GazeMode): Promise<GazeMode> => ipcRenderer.invoke("gaze:set-mode", mode),
  getGazeMode: (): Promise<GazeMode> => ipcRenderer.invoke("gaze:get-mode"),
  togglePhysics: (): Promise<boolean> => ipcRenderer.invoke("physics:toggle"),
  isPhysicsEnabled: (): Promise<boolean> => ipcRenderer.invoke("physics:is-enabled"),
  getCameraState: (): Promise<CameraState | null> => ipcRenderer.invoke("camera:get-state"),
  saveCameraState: (state: CameraState): Promise<void> =>
    ipcRenderer.invoke("camera:save-state", state),
  toggleIdleMotion: (): Promise<boolean> => ipcRenderer.invoke("idle:toggle"),
  isIdleMotionEnabled: (): Promise<boolean> => ipcRenderer.invoke("idle:is-enabled"),
  close: (): void => ipcRenderer.send("window:close"),
  beginWindowDrag: (): void => ipcRenderer.send("window:drag-start"),
  updateWindowDrag: (): void => ipcRenderer.send("window:drag-update"),
  endWindowDrag: (): void => ipcRenderer.send("window:drag-end"),
  beginWindowResize: (): void => ipcRenderer.send("window:resize-start"),
  updateWindowResize: (): void => ipcRenderer.send("window:resize-update"),
  endWindowResize: (): void => ipcRenderer.send("window:resize-end"),
  showMenu: (): void => ipcRenderer.send("menu:show"),
  showInteractionModeMenu: (): void => ipcRenderer.send("menu:show-interaction-mode"),
  showGazeModeMenu: (): void => ipcRenderer.send("menu:show-gaze-mode"),
  onOpenModel: (callback: () => void): void => {
    ipcRenderer.on("menu:open-model", callback);
  },
  onOpenMotion: (callback: () => void): void => {
    ipcRenderer.on("menu:open-motion", callback);
  },
  onAlwaysOnTopChanged: (callback: (value: boolean) => void): void => {
    ipcRenderer.on("window:always-on-top-changed", (_event, value: boolean) => callback(value));
  },
  onInteractionModeChanged: (callback: (value: InteractionMode) => void): void => {
    ipcRenderer.on("interaction:mode-changed", (_event, value: InteractionMode) => callback(value));
  },
  onGazeModeChanged: (callback: (value: GazeMode) => void): void => {
    ipcRenderer.on("gaze:mode-changed", (_event, value: GazeMode) => callback(value));
  },
  onPhysicsEnabledChanged: (callback: (value: boolean) => void): void => {
    ipcRenderer.on("physics:enabled-changed", (_event, value: boolean) => callback(value));
  },
  onGlobalCursorPosition: (callback: (position: { x: number; y: number }) => void): void => {
    ipcRenderer.on("cursor:global-position", (_event, position: { x: number; y: number }) =>
      callback(position),
    );
  },
  onIdleMotionChanged: (callback: (value: boolean) => void): void => {
    ipcRenderer.on("idle:enabled-changed", (_event, value: boolean) => callback(value));
  },
});
