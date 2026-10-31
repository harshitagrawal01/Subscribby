/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  /** SHA-256 (hex) of the secret staff console path segment. Generate with `npm run staff-path`. */
  readonly VITE_STAFF_PATH_HASH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
