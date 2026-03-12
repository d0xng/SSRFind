import { Classic } from "@caido/primevue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import { SDKPlugin } from "./plugins/sdk";
import "./styles/index.css";
import type { FrontendSDK } from "./types";
import App from "./views/App.vue";

export const init = (sdk: FrontendSDK): void => {
  (window as unknown as { __caidoSDK?: FrontendSDK }).__caidoSDK = sdk;

  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);

  app.use(PrimeVue, {
    unstyled: true,
    pt: Classic,
  });

  app.use(SDKPlugin, sdk);

  const root = document.createElement("div");
  root.id = "plugin--ssrfind";
  Object.assign(root.style, {
    height: "100%",
    width: "100%",
  });

  app.mount(root);

  sdk.navigation.addPage("/ssrfind", {
    body: root,
  });

  sdk.sidebar.registerItem("SSRFind", "/ssrfind", {
    icon: "fas fa-crosshairs",
  });
};
