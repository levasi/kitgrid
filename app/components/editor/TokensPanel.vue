<script setup lang="ts">
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'

const documents = useDocumentStore()
const actions = useDocumentActions()

function text(event: Event) {
  return (event.target as HTMLInputElement).value
}

function number(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  return Number.isFinite(value) ? value : 0
}
</script>

<template>
  <div class="token-panel">
    <section>
      <header class="section-head">
        <h2>Colors</h2>
        <button type="button" @click="actions.addColor">
          Add
        </button>
      </header>
      <div v-for="token in documents.document.tokens.colors" :key="token.id" class="token-row">
        <input :value="token.name" @change="actions.patchColor(token.id, { name: text($event) })">
        <ColorField
          :value="token.value"
          :show-tokens="false"
          @input="value => actions.previewColor(token.id, value)"
          @change="value => actions.commitColor(token.id, value)"
          @cancel="actions.cancelEdit()"
        />
        <button type="button" class="icon-button" title="Delete color" @click="actions.deleteColor(token.id)">
          ×
        </button>
      </div>
    </section>
    <section>
      <header class="section-head">
        <h2>Spacing</h2>
        <button type="button" @click="actions.addSpacing">
          Add
        </button>
      </header>
      <div v-for="token in documents.document.tokens.spacing" :key="token.id" class="token-row">
        <input :value="token.name" @change="actions.patchSpacing(token.id, { name: text($event) })">
        <input
          type="number"
          :value="token.value"
          @change="actions.patchSpacing(token.id, { value: number($event) })"
        >
        <span class="unit">px</span>
        <button type="button" class="icon-button" title="Delete spacing" @click="actions.deleteSpacing(token.id)">
          ×
        </button>
      </div>
    </section>
    <section>
      <header class="section-head">
        <h2>Typography</h2>
        <button type="button" @click="actions.addTypography">
          Add
        </button>
      </header>
      <article v-for="token in documents.document.tokens.typography" :key="token.id" class="type-token">
        <div class="token-row">
          <input :value="token.name" @change="actions.patchTypography(token.id, { name: text($event) })">
          <button type="button" class="icon-button" title="Delete type style" @click="actions.deleteTypography(token.id)">
            ×
          </button>
        </div>
        <label class="field">
          <span>Family</span>
          <input :value="token.fontFamily" @change="actions.patchTypography(token.id, { fontFamily: text($event) })">
        </label>
        <div class="field-grid">
          <label class="field">
            <span>Size</span>
            <input type="number" min="1" :value="token.fontSize" @change="actions.patchTypography(token.id, { fontSize: number($event) })">
          </label>
          <label class="field">
            <span>Weight</span>
            <input type="number" min="1" :value="token.fontWeight" @change="actions.patchTypography(token.id, { fontWeight: number($event) })">
          </label>
          <label class="field">
            <span>Line</span>
            <input type="number" min="0.5" step="0.05" :value="token.lineHeight" @change="actions.patchTypography(token.id, { lineHeight: number($event) })">
          </label>
        </div>
      </article>
    </section>
  </div>
</template>
