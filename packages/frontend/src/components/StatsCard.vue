<script setup lang="ts">
defineProps<{
  label: string;
  value: number | string;
  icon: string;
  accent?: "blue" | "green" | "orange" | "red" | "purple";
}>();

const ACCENTS = {
  blue:   "text-blue-400",
  green:  "text-green-400",
  orange: "text-orange-400",
  red:    "text-red-400",
  purple: "text-purple-400",
};
</script>

<template>
  <div class="bg-surface-800 border border-surface-700 rounded-lg p-4 flex flex-col gap-1">
    <div class="flex items-center gap-2 text-surface-400 text-xs uppercase tracking-wider">
      <i :class="[icon, 'text-sm', ACCENTS[accent ?? 'blue']]" />
      {{ label }}
    </div>
    <div :class="['text-2xl font-bold font-mono', ACCENTS[accent ?? 'blue']]">
      {{ value }}
    </div>
  </div>
</template>
