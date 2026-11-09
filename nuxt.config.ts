// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/editor.css'],
  components: [
    { path: '~/components', pathPrefix: false },
  ],
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      title: 'Kitgrid',
      meta: [
        { name: 'description', content: 'An open-source design-system editor.' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      googleClientId: '',
    },
  },
  typescript: {
    strict: true,
  },
  vite: {
    optimizeDeps: {
      include: ['zod', '@vue/devtools-core'],
    },
  },
})
