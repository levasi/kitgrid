<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()

const roots = computed(() => {
  if (editor.editingComponentId) {
    const component = documents.document.components.find(item => item.id === editor.editingComponentId)
    return component ? [component.root] : []
  }
  const page = documents.document.pages.find(item => item.id === editor.activePageId)
  return page?.children ?? []
})

function onRename(pageId: string, event: Event) {
  const value = (event.target as HTMLInputElement).value
  actions.renamePage(pageId, value)
}
</script>

<template>
  <aside class="panel left-panel">
    <section>
      <header class="section-head">
        <h2>Pages</h2>
        <button type="button" title="Add page" @click="actions.createPage">
          Add
        </button>
      </header>
      <ul class="page-list">
        <li v-for="page in documents.document.pages" :key="page.id">
          <input
            class="page-name"
            :class="{ active: page.id === editor.activePageId && !editor.editingComponentId }"
            :value="page.name"
            @focus="actions.openPage(page.id)"
            @change="onRename(page.id, $event)"
          >
          <button
            type="button"
            class="icon-button"
            title="Delete page"
            :disabled="documents.document.pages.length < 2"
            @click="actions.removePage(page.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </section>
    <section>
      <header class="section-head">
        <h2>Components</h2>
      </header>
      <ul class="component-list">
        <li v-for="component in documents.document.components" :key="component.id">
          <span class="component-name">{{ component.name }}</span>
          <button type="button" @click="actions.editComponent(component.id)">
            Edit
          </button>
          <button type="button" @click="actions.place(component.id)">
            Place
          </button>
        </li>
        <li v-if="documents.document.components.length === 0" class="empty">
          No components
        </li>
      </ul>
    </section>
    <section class="tree-section">
      <header class="section-head">
        <h2>Objects</h2>
      </header>
      <ul v-if="roots.length" class="object-tree">
        <ObjectTreeItem
          v-for="node in roots"
          :key="node.id"
          :node="node"
          :depth="0"
        />
      </ul>
      <p v-else class="empty">
        This page is empty.
      </p>
    </section>
  </aside>
</template>
