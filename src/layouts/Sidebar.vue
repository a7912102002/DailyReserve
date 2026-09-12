<template>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <span>DAILY<br />RESERVE</span>
    </div>

    <p class="brand-caption">存下生活的從容<br />從細節開始。</p>

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

    <div class="sidebar-decoration" aria-hidden="true"><i></i><i></i><i></i></div>
    <small class="sidebar-footer">DAILY RESERVE<br />EST. 2024<br />FOR A CALMER HOME</small>
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
