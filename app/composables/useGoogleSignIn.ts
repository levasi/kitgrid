const scriptSource = 'https://accounts.google.com/gsi/client'

let loading: Promise<void> | null = null

function loadGoogleScript() {
  if (window.google?.accounts.id) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptSource}"]`)
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded.')), { once: true })
    if (!existing) {
      script.src = scriptSource
      script.async = true
      script.defer = true
      document.head.append(script)
    }
  })
  return loading
}

export async function renderGoogleButton(host: HTMLElement, clientId: string, onCredential: (credential: string) => void) {
  await loadGoogleScript()
  const google = window.google
  if (!google) throw new Error('Google sign-in could not be loaded.')
  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      if (response.credential) onCredential(response.credential)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  })
  host.replaceChildren()
  google.accounts.id.renderButton(host, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: 320,
    logo_alignment: 'left',
  })
}
