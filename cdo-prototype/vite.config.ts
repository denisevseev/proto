import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Simple request logger: IP, user-agent, url → logip.log at project root
    ((): Plugin => {
      const logFile = path.resolve(process.cwd(), 'logip.log')
      const append = (line: string) => {
        try { fs.appendFile(logFile, line + '\n', () => {}) } catch {}
      }
      const handler = (req: any) => {
        const method = req.method || 'GET'
        if (method !== 'GET') return
        const url = req.url || '/'
        const ua = (req.headers && (req.headers['user-agent'] || '')) as string
        // Try common proxy header first, fallback to socket
        const fwd = (req.headers && req.headers['x-forwarded-for']) as string | string[] | undefined
        const ip = Array.isArray(fwd) ? fwd[0] : (fwd ? String(fwd).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || '')
        const ts = new Date().toISOString()
        append(`${ts}\t${ip}\t${ua}\t${method} ${url}`)
      }
      return {
        name: 'request-logger',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => { handler(req); next() })
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, _res, next) => { handler(req); next() })
        },
      }
    })(),
  ],
})
