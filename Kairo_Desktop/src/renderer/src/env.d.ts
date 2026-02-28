/// <reference types="vite/client" />

import type { KairoApi } from '../../preload/index.d'

declare global {
  interface Window {
    kairoApi: KairoApi
  }
}
