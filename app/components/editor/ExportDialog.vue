<script setup lang="ts">
import { computed, ref } from 'vue'
import { generateReact } from '#shared/codegen/react'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const documents = useDocumentStore()
const editor = useEditorStore()
const copied = ref<'react' | 'css' | null>(null)

const page = computed(() =>
  documents.document.pages.find(item => item.id === editor.activePageId) ?? documents.document.pages[0] ?? null,
)
const generated = computed(() => {
  if (!page.value) return null
  try {
    return generateReact(documents.document, page.value.id)
  } catch (error) {
    return { react: error instanceof Error ? error.message : 'Export failed.', css: '' }
  }
})

async function copy(kind: 'react' | 'css') {
  const value = kind === 'react' ? generated.value?.react : generated.value?.css
  if (!value) return
  await navigator.clipboard.writeText(value)
  copied.value = kind
  window.setTimeout(() => {
    if (copied.value === kind) copied.value = null
  }, 1500)
}

function close() {
  editor.exportOpen = false
}
</script>

<template>
  <div v-if="editor.exportOpen" class="modal-backdrop" @pointerdown.self="close">
    <section class="modal" role="dialog" aria-labelledby="export-title">
      <header class="modal-head">
        <div>
          <h2 id="export-title">
            Export {{ page?.name ?? 'page' }}
          </h2>
          <p>React and CSS are generated from the document, not from the canvas DOM.</p>
        </div>
        <button type="button" @click="close">
          Close
        </button>
      </header>
      <div class="export-grid">
        <label class="code-block">
          <span>
            React
            <button type="button" @click="copy('react')">{{ copied === 'react' ? 'Copied' : 'Copy' }}</button>
          </span>
          <textarea readonly spellcheck="false" :value="generated?.react ?? ''" />
        </label>
        <label class="code-block">
          <span>
            CSS
            <button type="button" @click="copy('css')">{{ copied === 'css' ? 'Copied' : 'Copy' }}</button>
          </span>
          <textarea readonly spellcheck="false" :value="generated?.css ?? ''" />
        </label>
      </div>
    </section>
  </div>
</template>
