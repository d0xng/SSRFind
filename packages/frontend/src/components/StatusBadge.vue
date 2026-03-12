<script setup lang="ts">
import type { ProbeStatus, ConfirmStatus } from "../types";

const props = defineProps<{
  status: ProbeStatus | ConfirmStatus | "phase1" | "port_scan" | "headers" | "ip_bypass" | "exploitable";
  small?: boolean;
}>();

const CONFIG: Record<string, { label: string; classes: string }> = {
  pending:        { label: "Pending",        classes: "bg-surface-700 text-surface-300" },
  sent:           { label: "Sent",           classes: "bg-blue-500/20 text-blue-400 border border-blue-500/40" },
  error:          { label: "Error",          classes: "bg-red-500/20 text-red-400 border border-red-500/40" },
  timeout:        { label: "Timeout",        classes: "bg-orange-500/20 text-orange-400 border border-orange-500/40" },
  done:           { label: "Done",           classes: "bg-surface-600 text-surface-300" },
  unconfirmed:    { label: "Unconfirmed",    classes: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" },
  confirmed:      { label: "✓ Confirmed",    classes: "bg-green-500/20 text-green-400 border border-green-500/40" },
  false_positive: { label: "False +",        classes: "bg-surface-600 text-surface-400 line-through" },
  phase1:         { label: "Phase 1",        classes: "bg-blue-500/20 text-blue-300 border border-blue-500/30" },
  port_scan:      { label: "Port Scan",      classes: "bg-purple-500/20 text-purple-300 border border-purple-500/30" },
  headers:        { label: "Headers",        classes: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" },
  ip_bypass:      { label: "IP Bypass",      classes: "bg-orange-500/20 text-orange-300 border border-orange-500/30" },
  exploitable:    { label: "Exploitable",    classes: "bg-green-500/30 text-green-300 border border-green-500/50 font-bold" },
};

const config = CONFIG[props.status] ?? { label: props.status, classes: "bg-surface-700 text-surface-300" };
</script>

<template>
  <span
    :class="[
      'inline-flex items-center rounded font-mono tracking-wide',
      small ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs',
      config.classes,
    ]"
  >
    {{ config.label }}
  </span>
</template>
