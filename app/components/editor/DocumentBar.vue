<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronDown, Grid3x3, Magnet } from '@lucide/vue'
import { GRID_SIZES, type GridStyle, type SnapKind } from '#shared/document/snap'
import { renderGoogleButton } from '../../composables/useGoogleSignIn'
import { accountFromCredential, useSessionStore } from '../../stores/session'

const emit = defineEmits<{
  open: []
  save: []
  saveAs: []
}>()

const editor = useEditorStore()
const session = useSessionStore()
const clientId = useRuntimeConfig().public.googleClientId
const googleHost = ref<HTMLElement | null>(null)
const signInError = ref('')
const zoomLabel = computed(() => `${Math.round(editor.zoom * 100)}%`)
const snapMenuOpen = ref(false)
const gridMenuOpen = ref(false)
const snapRoot = ref<HTMLElement | null>(null)
const gridRoot = ref<HTMLElement | null>(null)
const accountRoot = ref<HTMLElement | null>(null)
const accountOpen = ref(false)

const snapTypes: Array<{ id: SnapKind, label: string }> = [
  { id: 'grid', label: 'Grid' },
  { id: 'edges', label: 'Layer edges' },
  { id: 'centers', label: 'Layer centers' },
  { id: 'pixels', label: 'Pixels' },
]
const gridStyles: Array<{ id: GridStyle, label: string }> = [
  { id: 'lines', label: 'Lines' },
  { id: 'dots', label: 'Dots' },
]

function onWindowPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (snapRoot.value?.contains(target) || gridRoot.value?.contains(target) || accountRoot.value?.contains(target)) return
  snapMenuOpen.value = false
  gridMenuOpen.value = false
  accountOpen.value = false
}

function onWindowKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  snapMenuOpen.value = false
  gridMenuOpen.value = false
  accountOpen.value = false
}

function signOut() {
  accountOpen.value = false
  session.signOut()
}

watch(accountOpen, async (open) => {
  if (!open || session.user || !clientId) return
  await nextTick()
  if (!googleHost.value) return
  try {
    await renderGoogleButton(googleHost.value, clientId, (credential) => {
      const account = accountFromCredential(credential, clientId)
      if (!account) {
        signInError.value = 'Google did not return a usable account.'
        return
      }
      signInError.value = ''
      session.signIn(account)
      accountOpen.value = false
    })
  } catch (cause) {
    signInError.value = cause instanceof Error ? cause.message : 'Google sign-in could not be loaded.'
  }
})

onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown)
  window.addEventListener('keydown', onWindowKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown)
  window.removeEventListener('keydown', onWindowKeyDown)
})
</script>

<template>
  <header class="document-bar">
    <div class="brand">
      Kitgrid
    </div>
    <button type="button" class="zoom-label" title="Zoom to 100%" @click="editor.resetZoom">
      {{ zoomLabel }}
    </button>
    <div ref="gridRoot" class="snap-control">
      <button
        type="button"
        class="icon-button"
        :class="{ active: editor.gridVisible }"
        :aria-pressed="editor.gridVisible"
        :aria-label="editor.gridVisible ? 'Hide grid' : 'Show grid'"
        :title="editor.gridVisible ? 'Hide grid' : 'Show grid'"
        @click="editor.gridVisible = !editor.gridVisible"
      >
        <Grid3x3 :size="14" :stroke-width="2" />
      </button>
      <button
        type="button"
        class="icon-button"
        :class="{ active: gridMenuOpen }"
        title="Grid options"
        aria-haspopup="menu"
        :aria-expanded="gridMenuOpen"
        @click="gridMenuOpen = !gridMenuOpen"
      >
        <ChevronDown :size="14" :stroke-width="2" />
      </button>
      <div v-if="gridMenuOpen" class="snap-menu" role="menu">
        <p>Size</p>
        <label v-for="size in GRID_SIZES" :key="size">
          <input
            type="radio"
            name="grid-size"
            :checked="editor.gridSize === size"
            @change="editor.gridSize = size"
          >
          {{ size }}px
        </label>
        <p>Style</p>
        <label v-for="style in gridStyles" :key="style.id">
          <input
            type="radio"
            name="grid-style"
            :checked="editor.gridStyle === style.id"
            @change="editor.gridStyle = style.id"
          >
          {{ style.label }}
        </label>
        <label>
          <input
            type="checkbox"
            :checked="editor.gridMajor"
            @change="editor.gridMajor = !editor.gridMajor"
          >
          Major every 8
        </label>
      </div>
    </div>
    <div ref="snapRoot" class="snap-control">
      <button
        type="button"
        class="icon-button"
        :class="{ active: editor.snap }"
        :aria-pressed="editor.snap"
        aria-label="Snap"
        :title="editor.snap ? 'Turn snap off' : 'Turn snap on'"
        @click="editor.snap = !editor.snap"
      >
        <Magnet :size="14" :stroke-width="2" />
      </button>
      <button
        type="button"
        class="icon-button"
        :class="{ active: snapMenuOpen }"
        title="Snap types"
        aria-haspopup="menu"
        :aria-expanded="snapMenuOpen"
        @click="snapMenuOpen = !snapMenuOpen"
      >
        <ChevronDown :size="14" :stroke-width="2" />
      </button>
      <div v-if="snapMenuOpen" class="snap-menu" role="menu">
        <p>Snap to</p>
        <label v-for="item in snapTypes" :key="item.id">
          <input
            type="checkbox"
            :checked="editor.snapKinds.includes(item.id)"
            @change="editor.toggleSnapKind(item.id)"
          >
          {{ item.label }}
        </label>
      </div>
    </div>
    <div class="document-spacer" />
    <div class="toolbar-group">
      <button type="button" @click="emit('open')">
        Open
      </button>
      <button type="button" @click="emit('save')">
        Save
      </button>
      <button type="button" @click="emit('saveAs')">
        Save as
      </button>
      <button type="button" class="primary" @click="editor.exportOpen = true">
        Export
      </button>
    </div>
    <div v-if="!session.user && clientId" ref="accountRoot" class="account">
      <button
        type="button"
        :aria-expanded="accountOpen"
        aria-haspopup="menu"
        @click="accountOpen = !accountOpen"
      >
        Sign in
      </button>
      <div v-if="accountOpen" class="snap-menu account-menu sign-in-menu" role="menu">
        <div ref="googleHost" class="google-button" />
        <p v-if="signInError" class="sign-in-error">
          {{ signInError }}
        </p>
      </div>
    </div>
    <div v-if="session.user" ref="accountRoot" class="account">
      <button
        type="button"
        class="account-button"
        :aria-expanded="accountOpen"
        aria-haspopup="menu"
        @click="accountOpen = !accountOpen"
      >
        <img v-if="session.user.picture" :src="session.user.picture" alt="" referrerpolicy="no-referrer">
        <span>{{ session.user.name }}</span>
      </button>
      <div v-if="accountOpen" class="snap-menu account-menu" role="menu">
        <p>{{ session.user.email }}</p>
        <button type="button" role="menuitem" @click="signOut">
          Sign out
        </button>
      </div>
    </div>
  </header>
</template>
