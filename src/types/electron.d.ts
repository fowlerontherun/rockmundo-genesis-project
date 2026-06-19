// Ambient typings for the Electron preload bridge.
// Available only when the app runs inside the Rockmundo desktop shell.

export {};

declare global {
  interface Window {
    rockmundo?: {
      platform: NodeJS.Platform;
      isElectron: true;
      version: string;
    };
  }
}
