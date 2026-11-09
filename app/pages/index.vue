<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const desktop = computed(() => import.meta.client && Boolean(window.kitgrid))
const showEditor = computed(() => desktop.value || session.user !== null || session.skipped)
</script>

<template>
  <EditorShell v-if="showEditor" />
  <SignInScreen v-else />
</template>
