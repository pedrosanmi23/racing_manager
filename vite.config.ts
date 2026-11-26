import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Se compila a un único index.html autocontenido: se puede abrir con doble clic.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
})
