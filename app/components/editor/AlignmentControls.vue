<script setup lang="ts">
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
} from '@lucide/vue'
import { computed } from 'vue'
import { distributableCount, type AlignEdge, type DistributeAxis } from '#shared/document/mutations'
import { useDocumentActions } from '../../composables/useDocumentActions'
import { useDocumentStore } from '../../stores/document'
import { useEditorStore } from '../../stores/editor'

const actions = useDocumentActions()
const documents = useDocumentStore()
const editor = useEditorStore()

const canDistribute = computed(() => distributableCount(documents.document, editor.selection) >= 3)

const horizontal: Array<{ edge: AlignEdge, label: string, icon: typeof AlignStartVertical }> = [
  { edge: 'left', label: 'Align left', icon: AlignStartVertical },
  { edge: 'center', label: 'Align horizontal centers', icon: AlignCenterVertical },
  { edge: 'right', label: 'Align right', icon: AlignEndVertical },
]

const vertical: Array<{ edge: AlignEdge, label: string, icon: typeof AlignStartHorizontal }> = [
  { edge: 'top', label: 'Align top', icon: AlignStartHorizontal },
  { edge: 'middle', label: 'Align vertical centers', icon: AlignCenterHorizontal },
  { edge: 'bottom', label: 'Align bottom', icon: AlignEndHorizontal },
]

const spacing: Array<{ axis: DistributeAxis, label: string, icon: typeof AlignHorizontalSpaceBetween }> = [
  { axis: 'horizontal', label: 'Equal horizontal spacing', icon: AlignHorizontalSpaceBetween },
  { axis: 'vertical', label: 'Equal vertical spacing', icon: AlignVerticalSpaceBetween },
]
</script>

<template>
  <div class="align-field">
    <span>Alignment</span>
    <div class="align-row">
      <div class="align-group" role="group" aria-label="Horizontal alignment">
        <button
          v-for="item in horizontal"
          :key="item.edge"
          type="button"
          class="align-button"
          :title="item.label"
          :aria-label="item.label"
          @click="actions.align(item.edge)"
        >
          <component :is="item.icon" :size="14" :stroke-width="1.75" />
        </button>
      </div>
      <div class="align-group" role="group" aria-label="Vertical alignment">
        <button
          v-for="item in vertical"
          :key="item.edge"
          type="button"
          class="align-button"
          :title="item.label"
          :aria-label="item.label"
          @click="actions.align(item.edge)"
        >
          <component :is="item.icon" :size="14" :stroke-width="1.75" />
        </button>
      </div>
      <div class="align-group is-spacing" role="group" aria-label="Spacing">
        <button
          v-for="item in spacing"
          :key="item.axis"
          type="button"
          class="align-button"
          :title="canDistribute ? item.label : `${item.label} (select three or more objects)`"
          :aria-label="item.label"
          :disabled="!canDistribute"
          @click="actions.distribute(item.axis)"
        >
          <component :is="item.icon" :size="14" :stroke-width="1.75" />
        </button>
      </div>
    </div>
  </div>
</template>
