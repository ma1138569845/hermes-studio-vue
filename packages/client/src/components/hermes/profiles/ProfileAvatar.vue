<script setup lang="ts">
import { computed } from 'vue'
import { businessAvatarSvg, isLegacyCartoonAvatarDataUrl } from '@/utils/business-avatar'
import type { ProfileAvatar } from '@/api/hermes/profiles'

const props = withDefaults(defineProps<{
  name: string
  avatar?: ProfileAvatar | null
  size?: number
}>(), {
  size: 24,
})

const fallbackSeed = computed(() => props.name || 'default')
// Legacy multiavatar SVG data URLs (stored before the business-avatar
// switch) render as cartoon faces; fall back to the business initial.
const effectiveAvatar = computed<ProfileAvatar | null>(() => {
  const avatar = props.avatar
  if (avatar?.type === 'image' && avatar.dataUrl && isLegacyCartoonAvatarDataUrl(avatar.dataUrl)) {
    return null
  }
  return avatar || null
})
const generatedSvg = computed(() => businessAvatarSvg(props.name || 'default', props.avatar?.seed || fallbackSeed.value))
const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  flexBasis: `${props.size}px`,
}))
</script>

<template>
  <span class="profile-avatar-view" :style="style">
    <img
      v-if="effectiveAvatar?.type === 'image' && effectiveAvatar.dataUrl"
      class="profile-avatar-image"
      :src="effectiveAvatar.dataUrl"
      alt=""
      draggable="false"
    >
    <span v-else class="profile-avatar-svg" v-html="generatedSvg" />
  </span>
</template>

<style scoped>
.profile-avatar-view {
  display: inline-flex;
  flex: 0 0 auto;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-secondary);
}

.profile-avatar-image,
.profile-avatar-svg,
.profile-avatar-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.profile-avatar-image {
  object-fit: cover;
}
</style>
