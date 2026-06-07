import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const LORE_ROOT = path.resolve('.lore')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8',
}

function loreBrowser(): Plugin {
  let outDir = 'dist'

  return {
    name: 'lore-browser',
    configResolved(config: ResolvedConfig) {
      outDir = config.build.outDir
    },
    configureServer(server) {
      server.middlewares.use('/lore', handleLoreRequest)
    },
    closeBundle() {
      copyLoreToOutput(path.resolve(outDir, 'lore'))
    },
  }
}

function handleLoreRequest(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const urlPath = decodeURIComponent(req.url ?? '/')
  const fsPath = path.join(LORE_ROOT, urlPath)

  if (path.relative(LORE_ROOT, fsPath).startsWith('..')) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(fsPath)
  } catch {
    next()
    return
  }

  if (stat.isDirectory()) {
    // Redirect to trailing slash so relative links resolve correctly
    if (!urlPath.endsWith('/')) {
      res.statusCode = 301
      res.setHeader('Location', '/lore' + urlPath + '/')
      res.end()
      return
    }
    const parts = urlPath.split('/').filter(Boolean)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(buildIndexHtml(parts, fsPath))
  } else {
    const ext = path.extname(fsPath).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
    fs.createReadStream(fsPath).pipe(res)
  }
}

function copyLoreToOutput(destRoot: string): void {
  copyDir(LORE_ROOT, destRoot, [])
}

function copyDir(srcDir: string, destDir: string, parts: string[]): void {
  fs.mkdirSync(destDir, { recursive: true })
  fs.writeFileSync(path.join(destDir, 'index.html'), buildIndexHtml(parts, srcDir), 'utf-8')

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      copyDir(src, dest, [...parts, entry.name])
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

function buildIndexHtml(parts: string[], fsPath: string): string {
  const entries = fs.readdirSync(fsPath, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const rows = entries.map(e => {
    const icon = e.isDirectory() ? '&#128193;' : '&#128196;'
    const href = e.isDirectory() ? `${e.name}/` : e.name
    return `    <li><a href="${href}">${icon} ${e.name}</a></li>`
  }).join('\n')

  const title = parts.length > 0 ? parts[parts.length - 1] : '.lore'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — lore</title>
<style>
  body { font-family: sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #e0e0e0; background: #1a1a2e; }
  nav { color: #888; margin-bottom: 1.5rem; font-size: 0.9rem; }
  nav a { color: #7eb8f7; text-decoration: none; }
  nav a:hover { text-decoration: underline; }
  nav span { color: #e0e0e0; }
  ul { list-style: none; padding: 0; }
  li { padding: 0.3rem 0; }
  li a { text-decoration: none; color: #a0cfff; }
  li a:hover { text-decoration: underline; }
</style>
</head>
<body>
<nav>${buildBreadcrumbs(parts)}</nav>
<ul>
${rows}
</ul>
</body>
</html>`
}

function buildBreadcrumbs(parts: string[]): string {
  const depth = parts.length
  const crumbs: string[] = []

  for (let i = 0; i <= depth; i++) {
    const name = i === 0 ? '.lore' : parts[i - 1]
    const stepsUp = depth - i
    if (stepsUp === 0) {
      crumbs.push(`<span>${name}</span>`)
    } else {
      crumbs.push(`<a href="${'../'.repeat(stepsUp)}">${name}</a>`)
    }
  }

  return crumbs.join(' / ')
}

export default defineConfig({
  base: '/shattered-worlds/',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
  server: {
    allowedHosts: ['gsai.raptor-piranha.ts.net'],
  },
  plugins: [loreBrowser()],
})
