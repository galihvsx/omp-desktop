/**
 * Typed shim over the Wails-bound Go methods for the omp RPC bridge.
 *
 * The Go side (rpc.go) exposes three methods on the bound `App` struct and
 * streams protocol frames back as Wails events:
 *
 *   - StartRPC(cwd)   spawns `omp --mode rpc` (empty string = app cwd)
 *   - RPCSend(json)   writes one JSON command line to the process stdin
 *   - StopRPC()       terminates the process
 *
 * Frames arrive via the "omp:frame" event and process exit via "omp:rpc-exit"
 * (subscribed in src/stores/omp-chat-store.ts).
 *
 * The generated wrappers in wailsjs/go/main/App may lag behind the Go code,
 * so we call `window.go.main.App` directly instead of hand-editing those
 * generated files.
 */

/** Surface of the bound Go `App` struct that this shim depends on. */
export interface WailsOmpAppBridge {
  StartRPC(cwd: string): Promise<void>;
  RPCSend(command: string): Promise<void>;
  StopRPC(): Promise<void>;
}

declare global {
  interface Window {
    go?: {
      main?: {
        App?: WailsOmpAppBridge;
      };
    };
  }
}

function getBridge(): WailsOmpAppBridge | null {
  return window.go?.main?.App ?? null;
}

function bridgeMissingError(): Error {
  return new Error(
    "Wails bridge unavailable. Run the app through `wails dev` or a built binary."
  );
}

export async function callStartRPC(cwd: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StartRPC) {
    throw bridgeMissingError();
  }
  await bridge.StartRPC(cwd);
}

export async function callRPCSend(command: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.RPCSend) {
    throw bridgeMissingError();
  }
  await bridge.RPCSend(command);
}

export async function callStopRPC(): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.StopRPC) {
    throw bridgeMissingError();
  }
  await bridge.StopRPC();
}
