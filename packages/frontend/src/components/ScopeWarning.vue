<script setup lang="ts">
const props = defineProps<{
  type: "no_oob" | "no_scope";
}>();

const MESSAGES = {
  no_oob: {
    icon: "fas fa-link-slash",
    title: "OOB URL not configured",
    description:
      "SSRFind needs an Out-of-Band URL to detect SSRF callbacks. Copy the URL from QuickSSRF (or any interactsh client) and paste it in Settings.",
    cta: "Go to Settings",
    ctaEmit: "go-settings",
    color: "border-orange-500/40 bg-orange-500/5",
    iconColor: "text-orange-400",
  },
  no_scope: {
    icon: "fas fa-crosshairs",
    title: "No active scope configured",
    description:
      "SSRFind only scans requests within your Caido scope to avoid flooding unintended targets. Set a scope in Caido first, then come back.",
    cta: "Open Scope Settings",
    ctaEmit: "go-scope",
    color: "border-yellow-500/40 bg-yellow-500/5",
    iconColor: "text-yellow-400",
  },
};

const emit = defineEmits<{
  (e: "go-settings"): void;
  (e: "go-scope"): void;
}>();

const config = MESSAGES[props.type];
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center justify-center gap-4 rounded-xl border p-10 text-center',
      config.color,
    ]"
  >
    <i :class="[config.icon, 'text-4xl', config.iconColor]" />
    <div>
      <p class="font-semibold text-surface-100 text-lg">{{ config.title }}</p>
      <p class="text-surface-400 text-sm mt-1 max-w-md">{{ config.description }}</p>
    </div>
    <button
      class="px-4 py-2 rounded bg-surface-700 hover:bg-surface-600 text-surface-100 text-sm transition-colors"
      @click="emit(config.ctaEmit as 'go-settings' | 'go-scope')"
    >
      {{ config.cta }}
    </button>
  </div>
</template>
