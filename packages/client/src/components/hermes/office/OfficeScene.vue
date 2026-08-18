<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { OfficeSceneImpl } from './office-scene/engine'
import type { OfficeAgentProfile, OfficeSceneStrings } from './office-scene/engine'
import type { OfficeAction } from '@/api/hermes/office'

const props = defineProps<{
  profiles: OfficeAgentProfile[]
  strings: OfficeSceneStrings
}>()

const emit = defineEmits<{
  (event: 'agentClick', payload: { name: string; clientX: number; clientY: number }): void
  (event: 'failed'): void
  (event: 'ready'): void
}>()

function enqueueAction(action: OfficeAction): boolean {
  return engine?.enqueueAction(action) ?? false
}

function playEmote(name: string, animation: string): boolean {
  return engine?.playEmote(name, animation) ?? false
}

defineExpose({ enqueueAction, playEmote })

const mountEl = ref<HTMLElement | null>(null)
let engine: OfficeSceneImpl | null = null
let themeObserver: MutationObserver | null = null

function tearDown(): void {
  engine?.pause()
  engine?.destroy()
  engine = null
}

async function startScene(): Promise<void> {
  const mount = mountEl.value
  if (!mount || engine) return
  try {
    engine = new OfficeSceneImpl(props.strings)
    const ok = await engine.init(mount, (payload) => emit('agentClick', payload))
    if (!ok) throw new Error('Scene init returned false')
    engine.sync(props.profiles)
    engine.resume()
    emit('ready')
  } catch (error) {
    console.warn('[OfficeScene] init failed, using DOM fallback', error)
    tearDown()
    emit('failed')
  }
}

onMounted(() => {
  void startScene()
  // 主题切换时重建场景，让 Pixi 矢量颜色跟随 CSS 变量（水墨/深色主题）。
  themeObserver = new MutationObserver(() => {
    if (!engine) return
    tearDown()
    void startScene()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

watch(() => props.profiles, (list) => {
  if (engine) engine.sync(list)
})

onUnmounted(() => {
  themeObserver?.disconnect()
  themeObserver = null
  tearDown()
})
</script>

<template>
  <div ref="mountEl" class="office-scene" />
</template>

<style scoped lang="scss">
.office-scene {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-secondary);
}
</style>
