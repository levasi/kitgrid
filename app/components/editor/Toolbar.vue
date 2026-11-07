<script setup lang="ts">
import { Frame, MousePointer2, Pencil, PenTool, Square, Type } from '@lucide/vue'
import type { EditorTool } from '../../stores/editor'
import { useEditorStore } from '../../stores/editor'

const editor = useEditorStore()

const tools: Array<{ id: EditorTool, label: string, shortcut: string, icon: typeof MousePointer2 }> = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'frame', label: 'Frame', shortcut: 'F', icon: Frame },
  { id: 'shape', label: 'Shape', shortcut: 'R', icon: Square },
  { id: 'pen', label: 'Pen', shortcut: 'P', icon: PenTool },
  { id: 'pencil', label: 'Pencil', shortcut: 'Shift+P', icon: Pencil },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
]
</script>

<template>
  <div class="toolbar-dock">
    <div class="toolbar" role="toolbar" aria-label="Tools">
      <template v-for="(tool, index) in tools" :key="tool.id">
        <span v-if="index === 1 || index === 3 || index === 5" class="sep" />
        <button
          type="button"
          class="tool"
          :class="{ active: editor.tool === tool.id }"
          :aria-pressed="editor.tool === tool.id"
          :aria-label="`${tool.label} (${tool.shortcut})`"
          @click="editor.setTool(tool.id)"
        >
          <component :is="tool.icon" :size="18" :stroke-width="1.75" />
          <span class="tooltip" role="tooltip">
            {{ tool.label }}
            <kbd>{{ tool.shortcut }}</kbd>
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
