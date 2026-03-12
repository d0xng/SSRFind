import type { App } from "vue";
import type { FrontendSDK } from "../types";

const SDK_KEY = Symbol("caido-sdk");

export const SDKPlugin = {
  install(app: App, sdk: FrontendSDK) {
    app.provide(SDK_KEY, sdk);
  },
};

export function useSDK(): FrontendSDK {
  const sdk = (window as unknown as { __caidoSDK?: FrontendSDK }).__caidoSDK;
  if (!sdk) throw new Error("Caido SDK not available");
  return sdk;
}

export { SDK_KEY };
