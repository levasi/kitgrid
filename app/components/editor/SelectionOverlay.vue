<script setup lang="ts">
import { computed } from 'vue'
import type { ResizeHandle } from '#shared/document/geometry'
import type { Box } from '#shared/document/types'

const props = defineProps<{
  width: number
  height: number
  zoom: number
  boxes: Array<Box & { id: string }>
  hover: (Box & { id: string }) | null
  handles: boolean
}>()

const emit = defineEmits<{
  resize: [handle: ResizeHandle, event: PointerEvent]
}>()

const hoverBox = computed(() => {
  if (!props.hover) return null
  if (props.boxes.some(box => box.id === props.hover?.id)) return null
  return props.hover
})

const handleSize = computed(() => 8 / props.zoom)
const stroke = computed(() => 1.5 / props.zoom)

const handlePoints = computed(() => {
  const box = props.boxes.length === 1 ? props.boxes[0] : null
  if (!box || !props.handles) return []
  const points: Array<{ id: ResizeHandle, x: number, y: number }> = [
    { id: 'nw', x: box.x, y: box.y },
    { id: 'n', x: box.x + box.width / 2, y: box.y },
    { id: 'ne', x: box.x + box.width, y: box.y },
    { id: 'e', x: box.x + box.width, y: box.y + box.height / 2 },
    { id: 'se', x: box.x + box.width, y: box.y + box.height },
    { id: 's', x: box.x + box.width / 2, y: box.y + box.height },
    { id: 'sw', x: box.x, y: box.y + box.height },
    { id: 'w', x: box.x, y: box.y + box.height / 2 },
  ]
  return points
})

const cursors: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}
</script>

<template>
  <svg
    class="overlay"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
  >
    <rect
      v-if="hoverBox"
      :x="hoverBox.x"
      :y="hoverBox.y"
      :width="hoverBox.width"
      :height="hoverBox.height"
      class="hover-outline"
      :stroke-width="stroke"
      :stroke-dasharray="`${4 / zoom} ${3 / zoom}`"
    />
    <rect
      v-for="box in boxes"
      :key="box.id"
      :x="box.x"
      :y="box.y"
      :width="box.width"
      :height="box.height"
      class="selection-outline"
      :stroke-width="stroke"
    />
    <rect
      v-for="handle in handlePoints"
      :key="handle.id"
      class="handle"
      :x="handle.x - handleSize / 2"
      :y="handle.y - handleSize / 2"
      :width="handleSize"
      :height="handleSize"
      :stroke-width="stroke"
      :style="{ cursor: cursors[handle.id] }"
      @pointerdown.stop="emit('resize', handle.id, $event)"
    />
  </svg>
</template>
