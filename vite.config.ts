import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function fileStoragePlugin(): Plugin {
  const dataDir = path.resolve(__dirname, 'data')
  const dataFilePath = path.resolve(dataDir, 'db.json')

  return {
    name: 'file-storage-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/storage')) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true })
          }

          if (req.method === 'GET') {
            if (fs.existsSync(dataFilePath)) {
              const content = fs.readFileSync(dataFilePath, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(content)
            } else {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(null))
            }
            return
          }

          if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                fs.writeFileSync(dataFilePath, body, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true }))
              } catch (err) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(err) }))
              }
            })
            return
          }
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), fileStoragePlugin()],
  server: {
    watch: {
      ignored: ['**/data/**', '**/data/db.json', '**/db.json']
    }
  }
})
