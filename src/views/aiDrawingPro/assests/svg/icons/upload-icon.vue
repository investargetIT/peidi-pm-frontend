<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    :fill="color"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="lucide lucide-upload w-10 h-10 text-muted-foreground mb-3"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" x2="12" y1="3" y2="15"></line>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  color?: string;
}>();
</script>
