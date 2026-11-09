<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useDocumentStore } from '../../stores/document'

const props = withDefaults(defineProps<{
  label?: string
  value: string
  disabled?: boolean
  tokenId?: string | null
  showTokens?: boolean
}>(), {
  showTokens: true,
})

const emit = defineEmits<{
  input: [value: string]
  change: [value: string]
  cancel: []
  token: [id: string]
}>()

const documents = useDocumentStore()
const root = ref<HTMLElement | null>(null)
const swatch = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)
const tab = ref<'color' | 'tokens'>('color')
const format = ref<'hex' | 'rgb' | 'css' | 'hsl' | 'hsb'>('hex')
const formatMenu = ref(false)
const panelStyle = ref<Record<string, string>>({})
const hue = ref(0)
const saturation = ref(0)
const brightness = ref(0)
const opacity = ref(100)
let paletteDragging = false
let dragStart: string | null = null

const linkedToken = computed(() =>
  props.tokenId
    ? documents.document.tokens.colors.find(token => token.id === props.tokenId) ?? null
    : null,
)
const displayValue = computed(() => linkedToken.value?.value ?? props.value)

const empty = computed(() => {
  const value = displayValue.value.trim().toLowerCase()
  return !value || value === 'none' || value === 'transparent'
})

const pickerValue = computed(() => {
  const match = displayValue.value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (!match?.[1]) return '#000000'
  if (match[1].length === 3) {
    const [red, green, blue] = match[1]
    return `#${red}${red}${green}${green}${blue}${blue}`
  }
  return `#${match[1].slice(0, 6)}`
})

const hueColor = computed(() => `hsl(${hue.value} 100% 50%)`)
const currentHex = computed(() => hsvToHex(hue.value, saturation.value, brightness.value))
const pickerOutput = computed(() => {
  if (opacity.value >= 100) return currentHex.value
  const alpha = Math.round(opacity.value * 2.55).toString(16).padStart(2, '0')
  return `${currentHex.value}${alpha}`
})
const opacityTrackStyle = computed(() => ({
  backgroundImage: `linear-gradient(to right, ${currentHex.value}00, ${currentHex.value})`,
}))
const rgb = computed(() => {
  const value = currentHex.value.slice(1)
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  }
})
const hsl = computed(() => {
  const lightness = brightness.value * (1 - saturation.value / 2)
  const nextSaturation = lightness === 0 || lightness === 1
    ? 0
    : (brightness.value - lightness) / Math.min(lightness, 1 - lightness)
  return {
    hue: Math.round(hue.value),
    saturation: Math.round(nextSaturation * 100),
    lightness: Math.round(lightness * 100),
  }
})
const formatLabel = computed(() => format.value === 'hsb' ? 'HSB' : format.value.toUpperCase())
const colorInputValue = computed(() => {
  if (format.value === 'hex') return currentHex.value
  if (format.value === 'rgb') return `${rgb.value.red}, ${rgb.value.green}, ${rgb.value.blue}`
  if (format.value === 'css') return `rgb(${rgb.value.red} ${rgb.value.green} ${rgb.value.blue})`
  if (format.value === 'hsl') return `${hsl.value.hue}, ${hsl.value.saturation}%, ${hsl.value.lightness}%`
  return `${Math.round(hue.value)}, ${Math.round(saturation.value * 100)}%, ${Math.round(brightness.value * 100)}%`
})
const formats = [
  { id: 'hex', label: 'Hex' },
  { id: 'rgb', label: 'RGB' },
  { id: 'css', label: 'CSS' },
  { id: 'hsl', label: 'HSL' },
  { id: 'hsb', label: 'HSB' },
] as const

function hexToHsv(hex: string) {
  const normalized = hex.replace('#', '')
  return rgbToHsv(
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  )
}

function rgbToHsv(redValue: number, greenValue: number, blueValue: number) {
  const red = redValue / 255
  const green = greenValue / 255
  const blue = blueValue / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let nextHue = 0
  if (delta) {
    if (max === red) nextHue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) nextHue = 60 * ((blue - red) / delta + 2)
    else nextHue = 60 * ((red - green) / delta + 4)
  }
  if (nextHue < 0) nextHue += 360
  return {
    hue: nextHue,
    saturation: max === 0 ? 0 : delta / max,
    brightness: max,
  }
}

function hsvToHex(nextHue: number, nextSaturation: number, nextBrightness: number) {
  const chroma = nextBrightness * nextSaturation
  const section = nextHue / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  const match = nextBrightness - chroma
  let red = 0
  let green = 0
  let blue = 0
  if (section < 1) [red, green] = [chroma, x]
  else if (section < 2) [red, green] = [x, chroma]
  else if (section < 3) [green, blue] = [chroma, x]
  else if (section < 4) [green, blue] = [x, chroma]
  else if (section < 5) [red, blue] = [x, chroma]
  else [red, blue] = [chroma, x]
  return `#${[red, green, blue]
    .map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function syncPicker(value = displayValue.value) {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  const base = pickerValue.value
  const next = hexToHsv(base)
  hue.value = next.hue
  saturation.value = next.saturation
  brightness.value = next.brightness
  opacity.value = match?.[1]?.length === 8
    ? Math.round(Number.parseInt(match[1].slice(6, 8), 16) / 2.55)
    : 100
}

function updatePalette(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  saturation.value = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  brightness.value = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
  emit('input', pickerOutput.value)
}

function startPalette(event: PointerEvent) {
  paletteDragging = true
  dragStart = displayValue.value
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  updatePalette(event)
}

function movePalette(event: PointerEvent) {
  if (paletteDragging) updatePalette(event)
}

function finishColor() {
  paletteDragging = false
  const started = dragStart
  dragStart = null
  if (started && pickerOutput.value.toLowerCase() === started.trim().toLowerCase()) {
    emit('cancel')
    return
  }
  emit('change', pickerOutput.value)
}

function startHue() {
  dragStart = displayValue.value
}

function updateHue(event: Event) {
  hue.value = Number((event.target as HTMLInputElement).value)
  emit('input', pickerOutput.value)
}

function updateOpacity(event: Event) {
  opacity.value = Math.min(100, Math.max(0, Number((event.target as HTMLInputElement).value)))
  emit('input', pickerOutput.value)
}

function onOpacityText(event: Event) {
  opacity.value = Math.min(100, Math.max(0, Number((event.target as HTMLInputElement).value)))
  emit('change', pickerOutput.value)
}

function numbers(value: string) {
  return value.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
}

function applyRgb(red: number, green: number, blue: number) {
  const next = rgbToHsv(
    Math.min(255, Math.max(0, red)),
    Math.min(255, Math.max(0, green)),
    Math.min(255, Math.max(0, blue)),
  )
  hue.value = next.hue
  saturation.value = next.saturation
  brightness.value = next.brightness
}

function onColorText(event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  if (format.value === 'hex') {
    const match = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
    if (!match?.[1]) return
    const normalized = match[1].length === 3
      ? match[1].split('').map(character => character.repeat(2)).join('')
      : match[1]
    const next = hexToHsv(`#${normalized}`)
    hue.value = next.hue
    saturation.value = next.saturation
    brightness.value = next.brightness
  } else if (format.value === 'rgb' || format.value === 'css') {
    const [red, green, blue] = numbers(value)
    if (red === undefined || green === undefined || blue === undefined) return
    applyRgb(red, green, blue)
  } else if (format.value === 'hsl') {
    const [nextHue, nextSaturation, nextLightness] = numbers(value)
    if (nextHue === undefined || nextSaturation === undefined || nextLightness === undefined) return
    const lightness = Math.min(100, Math.max(0, nextLightness)) / 100
    const colorSaturation = Math.min(100, Math.max(0, nextSaturation)) / 100
    const chroma = (1 - Math.abs(2 * lightness - 1)) * colorSaturation
    const section = ((nextHue % 360) + 360) % 360 / 60
    const x = chroma * (1 - Math.abs((section % 2) - 1))
    const match = lightness - chroma / 2
    let red = 0
    let green = 0
    let blue = 0
    if (section < 1) [red, green] = [chroma, x]
    else if (section < 2) [red, green] = [x, chroma]
    else if (section < 3) [green, blue] = [chroma, x]
    else if (section < 4) [green, blue] = [x, chroma]
    else if (section < 5) [red, blue] = [x, chroma]
    else [red, blue] = [chroma, x]
    applyRgb((red + match) * 255, (green + match) * 255, (blue + match) * 255)
  } else {
    const [nextHue, nextSaturation, nextBrightness] = numbers(value)
    if (nextHue === undefined || nextSaturation === undefined || nextBrightness === undefined) return
    hue.value = ((nextHue % 360) + 360) % 360
    saturation.value = Math.min(100, Math.max(0, nextSaturation)) / 100
    brightness.value = Math.min(100, Math.max(0, nextBrightness)) / 100
  }
  emit('change', pickerOutput.value)
}

function chooseFormat(next: typeof formats[number]['id']) {
  format.value = next
  formatMenu.value = false
}

function onText(event: Event) {
  emit('change', (event.target as HTMLInputElement).value)
}

function positionPanel() {
  const rect = swatch.value?.getBoundingClientRect()
  if (!rect) return
  const width = 264
  const estimatedHeight = tab.value === 'tokens' ? 286 : 386
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
  const below = rect.bottom + 6
  const top = below + estimatedHeight <= window.innerHeight
    ? below
    : Math.max(8, rect.top - estimatedHeight - 6)
  panelStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (!open.value) return
  tab.value = 'color'
  syncPicker()
  await nextTick()
  positionPanel()
}

function chooseTab(next: 'color' | 'tokens') {
  tab.value = next
  formatMenu.value = false
}

async function chooseToken(id: string) {
  emit('token', id)
  await nextTick()
  syncPicker()
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (root.value?.contains(target) || panel.value?.contains(target)) return
  open.value = false
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (formatMenu.value) formatMenu.value = false
  else open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', positionPanel)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', positionPanel)
})
</script>

<template>
  <label v-if="label" class="field">
    <span>{{ label }}</span>
    <span ref="root" class="color-field">
      <button
        ref="swatch"
        type="button"
        class="color-swatch"
        :disabled="disabled"
        :aria-label="`Pick ${label}`"
        :aria-expanded="open"
        @click.prevent="toggle"
      >
        <span class="color-chip" :class="{ 'is-empty': empty }" :style="empty ? undefined : { backgroundColor: displayValue }" />
      </button>
      <input
        :value="displayValue"
        :disabled="disabled"
        spellcheck="false"
        :aria-label="label"
        @change="onText"
      >
    </span>
  </label>
  <span v-else ref="root" class="color-field">
    <button
      ref="swatch"
      type="button"
      class="color-swatch"
      :disabled="disabled"
      aria-label="Pick color"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="color-chip" :class="{ 'is-empty': empty }" :style="empty ? undefined : { backgroundColor: displayValue }" />
    </button>
    <input
      :value="displayValue"
      :disabled="disabled"
      spellcheck="false"
      aria-label="Color"
      @change="onText"
    >
  </span>
  <Teleport to="body">
    <div v-if="open" ref="panel" class="color-popover" :style="panelStyle" @click.stop>
      <div class="color-popover-tabs">
        <button type="button" :class="{ active: tab === 'color' }" @click="chooseTab('color')">
          Color
        </button>
        <button
          v-if="showTokens"
          type="button"
          :class="{ active: tab === 'tokens' }"
          @click="chooseTab('tokens')"
        >
          Tokens
        </button>
      </div>
      <div v-if="tab === 'color'" class="color-popover-custom">
        <div
          class="color-spectrum"
          :style="{ backgroundColor: hueColor }"
          role="slider"
          aria-label="Saturation and brightness"
          tabindex="0"
          @pointerdown="startPalette"
          @pointermove="movePalette"
          @pointerup="finishColor"
          @pointercancel="finishColor"
        >
          <span
            class="color-spectrum-thumb"
            :style="{ left: `${saturation * 100}%`, top: `${(1 - brightness) * 100}%` }"
          />
        </div>
        <div class="color-hue-row">
          <div class="color-hue-wrap">
            <input
              class="color-hue"
              type="range"
              min="0"
              max="359"
              :value="hue"
              aria-label="Hue"
              @pointerdown="startHue"
              @input="updateHue"
              @change="finishColor"
            >
            <span class="color-hue-thumb" :style="{ left: `${hue / 3.59}%` }" />
          </div>
        </div>
        <div class="color-opacity-row">
          <div class="color-opacity-wrap">
            <span class="color-opacity-track" :style="opacityTrackStyle" />
            <input
              class="color-opacity"
              type="range"
              min="0"
              max="100"
              :value="opacity"
              aria-label="Opacity"
              @pointerdown="startHue"
              @input="updateOpacity"
              @change="finishColor"
            >
            <span
              class="color-opacity-thumb"
              :style="{ left: `calc(${opacity}% + ${9 - opacity * 0.18}px)` }"
            />
          </div>
        </div>
        <div class="color-hex-row">
          <div class="color-format-select">
            <button
              type="button"
              class="color-format-trigger"
              :aria-expanded="formatMenu"
              @click="formatMenu = !formatMenu"
            >
              {{ formatLabel }}
              <span>⌄</span>
            </button>
            <div v-if="formatMenu" class="color-format-menu">
              <button
                v-for="option in formats"
                :key="option.id"
                type="button"
                :class="{ active: option.id === format }"
                @click="chooseFormat(option.id)"
              >
                <span>{{ option.id === format ? '✓' : '' }}</span>
                {{ option.label }}
              </button>
            </div>
          </div>
          <input :value="colorInputValue" :aria-label="`${formatLabel} color`" spellcheck="false" @change="onColorText">
          <span class="color-opacity-input">
            <input type="number" min="0" max="100" :value="opacity" aria-label="Opacity percentage" @change="onOpacityText">
            <span>%</span>
          </span>
        </div>
      </div>
      <div v-else class="color-token-list">
        <button
          v-for="token in documents.document.tokens.colors"
          :key="token.id"
          type="button"
          class="color-token-option"
          :class="{ active: token.id === tokenId }"
          @click="chooseToken(token.id)"
        >
          <span class="color-token-chip" :style="{ backgroundColor: token.value }" />
          <span>{{ token.name }}</span>
          <code>{{ token.value }}</code>
        </button>
        <p v-if="documents.document.tokens.colors.length === 0" class="hint">
          No color tokens defined.
        </p>
      </div>
    </div>
  </Teleport>
</template>
