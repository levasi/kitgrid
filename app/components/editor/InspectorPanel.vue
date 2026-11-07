<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { findNode } from '#shared/document/tree'
import type { FrameDirection, TextAlign } from '#shared/document/types'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const documents = useDocumentStore()
const editor = useEditorStore()
const actions = useDocumentActions()
const variantId = ref('')

const page = computed(() =>
  documents.document.pages.find(item => item.id === editor.activePageId) ?? documents.document.pages[0] ?? null,
)
const editing = computed(() =>
  documents.document.components.find(item => item.id === editor.editingComponentId) ?? null,
)
const selected = computed(() => {
  const id = editor.selection.length === 1 ? editor.selection[0] : null
  if (!id) return null
  return findNode(documents.document, id)?.node ?? null
})
const textNode = computed(() => selected.value?.type === 'text' ? selected.value : null)
const shapeNode = computed(() =>
  selected.value && (selected.value.type === 'rectangle' || selected.value.type === 'frame') ? selected.value : null,
)
const frameNode = computed(() => selected.value?.type === 'frame' ? selected.value : null)
const pathNode = computed(() => selected.value?.type === 'path' ? selected.value : null)
const instanceNode = computed(() => selected.value?.type === 'instance' ? selected.value : null)
const instanceComponent = computed(() => {
  if (!instanceNode.value) return null
  return documents.document.components.find(item => item.id === instanceNode.value?.componentId) ?? null
})
const activeVariant = computed(() =>
  editing.value?.variants.options.find(item => item.id === variantId.value) ?? editing.value?.variants.options[0] ?? null,
)
const effectiveLabel = computed(() =>
  instanceNode.value?.overrides.label ?? instanceComponent.value?.label.defaultValue ?? '',
)
const effectiveVariant = computed(() =>
  instanceNode.value?.overrides.variant ?? instanceComponent.value?.variants.defaultVariantId ?? '',
)

watch(editing, (component) => {
  variantId.value = component?.variants.defaultVariantId ?? component?.variants.options[0]?.id ?? ''
}, { immediate: true })

function text(event: Event) {
  return (event.target as HTMLInputElement).value
}

function number(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  return Number.isFinite(value) ? value : 0
}

function tokenId(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  return value || null
}

function patch(patchValue: Parameters<typeof actions.patchNode>[1]) {
  const id = selected.value?.id
  if (!id) return
  actions.patchNode(id, patchValue)
}
</script>

<template>
  <div class="inspector">
    <section v-if="editing" class="inspector-block">
      <h3>Component</h3>
      <label class="field">
        <span>Name</span>
        <input :value="editing.name" @change="actions.renameComponent(editing.id, text($event))">
      </label>
      <label class="field">
        <span>Default variant</span>
        <select :value="editing.variants.defaultVariantId" @change="actions.chooseDefaultVariant(editing.id, text($event))">
          <option v-for="option in editing.variants.options" :key="option.id" :value="option.id">
            {{ option.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Edit variant</span>
        <select v-model="variantId">
          <option v-for="option in editing.variants.options" :key="option.id" :value="option.id">
            {{ option.name }}
          </option>
        </select>
      </label>
      <template v-if="activeVariant">
        <label class="field">
          <span>Variant name</span>
          <input :value="activeVariant.name" @change="actions.patchVariant(editing.id, activeVariant.id, { name: text($event) })">
        </label>
        <label class="field">
          <span>Fill</span>
          <input :value="activeVariant.style.fill" @change="actions.patchVariant(editing.id, activeVariant.id, { fill: text($event) })">
        </label>
        <label class="field">
          <span>Fill token</span>
          <select :value="activeVariant.style.fillTokenId ?? ''" @change="actions.patchVariant(editing.id, activeVariant.id, { fillTokenId: tokenId($event) })">
            <option value="">
              Custom
            </option>
            <option v-for="token in documents.document.tokens.colors" :key="token.id" :value="token.id">
              {{ token.name }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>Text</span>
          <input :value="activeVariant.style.textColor" @change="actions.patchVariant(editing.id, activeVariant.id, { textColor: text($event) })">
        </label>
        <label class="field">
          <span>Text token</span>
          <select :value="activeVariant.style.textColorTokenId ?? ''" @change="actions.patchVariant(editing.id, activeVariant.id, { textColorTokenId: tokenId($event) })">
            <option value="">
              Custom
            </option>
            <option v-for="token in documents.document.tokens.colors" :key="token.id" :value="token.id">
              {{ token.name }}
            </option>
          </select>
        </label>
        <div class="field-grid">
          <label class="field">
            <span>Radius</span>
            <input type="number" min="0" :value="activeVariant.style.radius" @change="actions.patchVariant(editing.id, activeVariant.id, { radius: number($event) })">
          </label>
          <label class="field">
            <span>Stroke</span>
            <input type="number" min="0" :value="activeVariant.style.strokeWidth" @change="actions.patchVariant(editing.id, activeVariant.id, { strokeWidth: number($event) })">
          </label>
        </div>
      </template>
    </section>

    <section v-if="editor.selection.length > 1" class="inspector-block">
      <h3>{{ editor.selection.length }} objects selected</h3>
      <p class="hint">
        Group them if they share a parent. Drag moves every selected object.
      </p>
    </section>

    <section v-else-if="!selected" class="inspector-block">
      <h3>{{ editing ? 'Component source' : page?.name ?? 'Page' }}</h3>
      <label class="field">
        <span>Document</span>
        <input :value="documents.document.name" @change="actions.renameDocument(text($event))">
      </label>
      <template v-if="page && !editing">
        <div class="field-grid">
          <label class="field">
            <span>Page width</span>
            <input type="number" min="1" :value="page.width" @change="actions.resizePage(page.id, { width: number($event) })">
          </label>
          <label class="field">
            <span>Page height</span>
            <input type="number" min="1" :value="page.height" @change="actions.resizePage(page.id, { height: number($event) })">
          </label>
        </div>
      </template>
      <p class="hint">
        Select an object to edit it.
      </p>
    </section>

    <section v-else class="inspector-block">
      <h3>{{ selected.type }}</h3>
      <label class="field">
        <span>Name</span>
        <input :value="selected.name" @change="patch({ name: text($event) })">
      </label>
      <div class="field-grid">
        <label class="field">
          <span>X</span>
          <input type="number" :value="selected.x" @change="patch({ x: number($event) })">
        </label>
        <label class="field">
          <span>Y</span>
          <input type="number" :value="selected.y" @change="patch({ y: number($event) })">
        </label>
        <label class="field">
          <span>W</span>
          <input type="number" min="1" :value="selected.width" @change="patch({ width: number($event) })">
        </label>
        <label class="field">
          <span>H</span>
          <input type="number" min="1" :value="selected.height" @change="patch({ height: number($event) })">
        </label>
      </div>
    </section>

    <section v-if="textNode" class="inspector-block">
      <label class="field">
        <span>Text</span>
        <textarea rows="3" :value="textNode.content" @change="patch({ content: text($event) })" />
      </label>
      <label class="field">
        <span>Align</span>
        <select :value="textNode.align" @change="patch({ align: text($event) as TextAlign })">
          <option value="left">
            Left
          </option>
          <option value="center">
            Center
          </option>
          <option value="right">
            Right
          </option>
        </select>
      </label>
      <label class="field">
        <span>Typography</span>
        <select :value="textNode.typographyTokenId ?? ''" @change="patch({ typographyTokenId: tokenId($event) })">
          <option value="">
            Custom
          </option>
          <option v-for="token in documents.document.tokens.typography" :key="token.id" :value="token.id">
            {{ token.name }}
          </option>
        </select>
      </label>
      <p v-if="textNode.typographyTokenId" class="hint">
        Linked to a type token. Clear it to edit size and weight on this object.
      </p>
      <div class="field-grid">
        <label class="field">
          <span>Size</span>
          <input type="number" min="1" :disabled="Boolean(textNode.typographyTokenId)" :value="textNode.fontSize" @change="patch({ fontSize: number($event) })">
        </label>
        <label class="field">
          <span>Weight</span>
          <input type="number" min="1" :disabled="Boolean(textNode.typographyTokenId)" :value="textNode.fontWeight" @change="patch({ fontWeight: number($event) })">
        </label>
      </div>
      <label class="field">
        <span>Color token</span>
        <select :value="textNode.colorTokenId ?? ''" @change="patch({ colorTokenId: tokenId($event) })">
          <option value="">
            Custom
          </option>
          <option v-for="token in documents.document.tokens.colors" :key="token.id" :value="token.id">
            {{ token.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Color</span>
        <input :disabled="Boolean(textNode.colorTokenId)" :value="textNode.color" @change="patch({ color: text($event) })">
      </label>
    </section>

    <section v-if="pathNode" class="inspector-block">
      <label class="field">
        <span>Fill token</span>
        <select :value="pathNode.fillTokenId ?? ''" @change="patch({ fillTokenId: tokenId($event) })">
          <option value="">
            None
          </option>
          <option v-for="token in documents.document.tokens.colors" :key="token.id" :value="token.id">
            {{ token.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Fill</span>
        <input :disabled="Boolean(pathNode.fillTokenId)" :value="pathNode.fill" @change="patch({ fill: text($event) })">
      </label>
      <label class="field">
        <span>Stroke</span>
        <input type="number" min="0" :value="pathNode.strokeWidth" @change="patch({ strokeWidth: number($event) })">
      </label>
      <label class="field">
        <span>Stroke token</span>
        <select :value="pathNode.strokeTokenId ?? ''" @change="patch({ strokeTokenId: tokenId($event) })">
          <option value="">
            Custom
          </option>
          <option v-for="token in documents.document.tokens.colors" :key="token.id" :value="token.id">
            {{ token.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Stroke color</span>
        <input :disabled="Boolean(pathNode.strokeTokenId)" :value="pathNode.stroke" @change="patch({ stroke: text($event) })">
      </label>
    </section>

    <section v-if="shapeNode" class="inspector-block">
      <label class="field">
        <span>Fill token</span>
        <select :value="shapeNode.fillTokenId ?? ''" @change="patch({ fillTokenId: tokenId($event) })">
          <option value="">
            Custom
          </option>
          <option v-for="token in documents.document.tokens.colors" :key="token.id" :value="token.id">
            {{ token.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Fill</span>
        <input :disabled="Boolean(shapeNode.fillTokenId)" :value="shapeNode.fill" @change="patch({ fill: text($event) })">
      </label>
      <div class="field-grid">
        <label class="field">
          <span>Radius</span>
          <input type="number" min="0" :value="shapeNode.radius" @change="patch({ radius: number($event) })">
        </label>
        <label class="field">
          <span>Stroke</span>
          <input type="number" min="0" :value="shapeNode.strokeWidth" @change="patch({ strokeWidth: number($event) })">
        </label>
      </div>
      <label class="field">
        <span>Stroke token</span>
        <select :value="shapeNode.strokeTokenId ?? ''" @change="patch({ strokeTokenId: tokenId($event) })">
          <option value="">
            Custom
          </option>
          <option v-for="token in documents.document.tokens.colors" :key="token.id" :value="token.id">
            {{ token.name }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Stroke color</span>
        <input :disabled="Boolean(shapeNode.strokeTokenId)" :value="shapeNode.stroke" @change="patch({ stroke: text($event) })">
      </label>
    </section>

    <section v-if="frameNode" class="inspector-block">
      <label class="field">
        <span>Padding token</span>
        <select :value="frameNode.paddingTokenId ?? ''" @change="patch({ paddingTokenId: tokenId($event) })">
          <option value="">
            Custom
          </option>
          <option v-for="token in documents.document.tokens.spacing" :key="token.id" :value="token.id">
            {{ token.name }}
          </option>
        </select>
      </label>
      <div class="field-grid">
        <label class="field">
          <span>Padding</span>
          <input type="number" min="0" :disabled="Boolean(frameNode.paddingTokenId)" :value="frameNode.padding" @change="patch({ padding: number($event) })">
        </label>
        <label class="field">
          <span>Gap</span>
          <input type="number" min="0" :disabled="Boolean(frameNode.gapTokenId)" :value="frameNode.gap" @change="patch({ gap: number($event) })">
        </label>
      </div>
      <label class="field">
        <span>Direction</span>
        <select :value="frameNode.direction" @change="patch({ direction: text($event) as FrameDirection })">
          <option value="none">
            Free
          </option>
          <option value="horizontal">
            Horizontal
          </option>
          <option value="vertical">
            Vertical
          </option>
        </select>
      </label>
      <label class="check">
        <input type="checkbox" :checked="frameNode.clip" @change="patch({ clip: ($event.target as HTMLInputElement).checked })">
        <span>Clip contents</span>
      </label>
    </section>

    <section v-if="instanceNode" class="inspector-block">
      <h3>{{ instanceComponent?.name ?? 'Missing component' }}</h3>
      <p class="hint" :class="{ override: instanceNode.overrides.label !== undefined }">
        {{ instanceNode.overrides.label === undefined ? 'Label linked to the component' : 'Label overridden' }}
      </p>
      <label class="field">
        <span>Label</span>
        <input :value="effectiveLabel" :disabled="!instanceComponent" @change="actions.setOverride(instanceNode.id, 'label', text($event))">
      </label>
      <button
        v-if="instanceNode.overrides.label !== undefined"
        type="button"
        @click="actions.setOverride(instanceNode.id, 'label', null)"
      >
        Reset label
      </button>
      <p class="hint" :class="{ override: instanceNode.overrides.variant !== undefined }">
        {{ instanceNode.overrides.variant === undefined ? 'Variant linked to the component' : 'Variant overridden' }}
      </p>
      <label class="field">
        <span>Variant</span>
        <select :value="effectiveVariant" :disabled="!instanceComponent" @change="actions.setOverride(instanceNode.id, 'variant', text($event))">
          <option v-for="option in instanceComponent?.variants.options ?? []" :key="option.id" :value="option.id">
            {{ option.name }}
          </option>
        </select>
      </label>
      <button
        v-if="instanceNode.overrides.variant !== undefined"
        type="button"
        @click="actions.setOverride(instanceNode.id, 'variant', null)"
      >
        Reset variant
      </button>
    </section>
  </div>
</template>
