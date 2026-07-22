/// <reference types="vite/client" />

type ModelInfo = {
  url: string;
  name: string;
};

type InteractionMode = "move" | "rotate" | "fixed";
type GazeMode = "none" | "camera" | "cursor";

type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
};

interface Window {
  pmxPal: {
    openModel: () => Promise<ModelInfo | null>;
    getSavedModel: () => Promise<ModelInfo | null>;
    openMotions: () => Promise<ModelInfo[] | null>;
    getSavedMotions: () => Promise<ModelInfo[]>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    isAlwaysOnTop: () => Promise<boolean>;
    setInteractionMode: (mode: InteractionMode) => Promise<InteractionMode>;
    getInteractionMode: () => Promise<InteractionMode>;
    setGazeMode: (mode: GazeMode) => Promise<GazeMode>;
    getGazeMode: () => Promise<GazeMode>;
    togglePhysics: () => Promise<boolean>;
    isPhysicsEnabled: () => Promise<boolean>;
    getCameraState: () => Promise<CameraState | null>;
    saveCameraState: (state: CameraState) => Promise<void>;
    toggleIdleMotion: () => Promise<boolean>;
    isIdleMotionEnabled: () => Promise<boolean>;
    close: () => void;
    beginWindowDrag: () => void;
    updateWindowDrag: () => void;
    endWindowDrag: () => void;
    beginWindowResize: () => void;
    updateWindowResize: () => void;
    endWindowResize: () => void;
    showMenu: () => void;
    showInteractionModeMenu: () => void;
    showGazeModeMenu: () => void;
    onOpenModel: (callback: () => void) => void;
    onOpenMotion: (callback: () => void) => void;
    onAlwaysOnTopChanged: (callback: (value: boolean) => void) => void;
    onInteractionModeChanged: (callback: (value: InteractionMode) => void) => void;
    onGazeModeChanged: (callback: (value: GazeMode) => void) => void;
    onPhysicsEnabledChanged: (callback: (value: boolean) => void) => void;
    onGlobalCursorPosition: (callback: (position: { x: number; y: number }) => void) => void;
    onIdleMotionChanged: (callback: (value: boolean) => void) => void;
  };
}
