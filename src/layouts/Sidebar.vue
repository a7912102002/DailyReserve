<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <span class="brand-mark">▤</span>
      <span>常備日和</span>
    </div>

    <nav>
      <button
        v-for="nav in navItems"
        :key="nav[0]"
        :class="{ active: activeNav === nav[0] }"
        @click="$emit('select', nav[0])"
      >
        <span class="nav-icon">{{ nav[1] }}</span>
        <span>{{ nav[0] }}</span>
      </button>
    </nav>

    <button class="help"><span>?</span> 使用說明</button>
  </aside>
</template>

<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  activeNav: {
    type: String,
    required: true,
  },
  navItems: {
    type: Array,
    required: true,
  },
})

defineEmits(['select'])
</script>
