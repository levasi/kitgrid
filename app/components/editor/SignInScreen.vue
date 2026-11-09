<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { renderGoogleButton } from '../../composables/useGoogleSignIn'
import { accountFromCredential, useSessionStore } from '../../stores/session'

const session = useSessionStore()
const config = useRuntimeConfig()
const clientId = config.public.googleClientId
const host = ref<HTMLElement | null>(null)
const error = ref('')

onMounted(async () => {
  if (!clientId || !host.value) return
  try {
    await renderGoogleButton(host.value, clientId, (credential) => {
      const account = accountFromCredential(credential, clientId)
      if (!account) {
        error.value = 'Google did not return a usable account.'
        return
      }
      error.value = ''
      session.signIn(account)
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Google sign-in could not be loaded.'
  }
})
</script>

<template>
  <main class="sign-in">
    <section>
      <p class="brand">
        Kitgrid
      </p>
      <h1>Sign in</h1>
      <p>Use your Google account to open the editor.</p>
      <div v-if="clientId" ref="host" class="google-button" />
      <p v-else class="hint">
        Add <code>NUXT_PUBLIC_GOOGLE_CLIENT_ID</code> to <code>.env</code>, then restart the app. Use a Google OAuth client of type Web application, and allow this site’s origin.
      </p>
      <p v-if="error" class="hint error">
        {{ error }}
      </p>
      <button v-if="!clientId" type="button" class="primary" @click="session.continueLocally()">
        Continue without an account
      </button>
    </section>
  </main>
</template>
