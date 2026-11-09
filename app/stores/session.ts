import { defineStore } from 'pinia'
import { ref } from 'vue'

const storageKey = 'kitgrid-session'

export interface GoogleAccount {
  id: string
  email: string
  name: string
  picture: string
  expiresAt: number
}

interface TokenPayload {
  iss?: string
  aud?: string
  exp?: number
  sub?: string
  email?: string
  name?: string
  picture?: string
}

function readStored(): GoogleAccount | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    const account = JSON.parse(raw) as GoogleAccount
    if (!account.id || !account.email || account.expiresAt <= Date.now()) {
      localStorage.removeItem(storageKey)
      return null
    }
    return account
  } catch {
    localStorage.removeItem(storageKey)
    return null
  }
}

function decodePayload(credential: string): TokenPayload | null {
  const part = credential.split('.')[1]
  if (!part) return null
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(padded.padEnd(padded.length + (4 - padded.length % 4) % 4, '='))
    return JSON.parse(json) as TokenPayload
  } catch {
    return null
  }
}

export function accountFromCredential(credential: string, clientId: string): GoogleAccount | null {
  const payload = decodePayload(credential)
  if (!payload) return null
  const issuer = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com'
  if (!issuer || payload.aud !== clientId) return null
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null
  if (!payload.sub || !payload.email) return null
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || '',
    expiresAt: payload.exp * 1000,
  }
}

export const useSessionStore = defineStore('session', () => {
  const user = ref<GoogleAccount | null>(readStored())
  const skipped = ref(false)

  function signIn(account: GoogleAccount) {
    user.value = account
    skipped.value = false
    localStorage.setItem(storageKey, JSON.stringify(account))
  }

  function continueLocally() {
    skipped.value = true
  }

  function signOut() {
    user.value = null
    skipped.value = false
    localStorage.removeItem(storageKey)
    window.google?.accounts.id.disableAutoSelect()
  }

  return { user, skipped, signIn, continueLocally, signOut }
})
