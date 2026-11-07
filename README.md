# Kitgrid

Open-source design-system editor. The same Nuxt frontend runs in the browser and in Electron.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run lint
npm run desktop:dev
npm run desktop:build
npm run desktop:start
```

`dev` is the web app. `desktop:dev` opens Electron against that dev server. `build` generates the static web app. `desktop:build` generates a relative-path build and bundles the Electron main process. `desktop:start` launches that desktop build.
