import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const url = 'http://127.0.0.1:5173'
let server

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Web Preview did not start at ${url}`)
}

async function serverAlreadyRunning() {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function browserLaunchOptions() {
  const configuredPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const executablePath = configuredPath || (existsSync(macChromePath) ? macChromePath : undefined)
  return { headless: true, ...(executablePath ? { executablePath } : {}) }
}

try {
  if (!(await serverAlreadyRunning())) {
    server = spawn('npm', ['run', 'dev:web', '--', '--host', '127.0.0.1'], {
      stdio: 'inherit',
      env: process.env,
    })
  }
  await waitForServer()

  const browser = await chromium.launch(browserLaunchOptions())
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(url)

    assert(await page.locator('html').getAttribute('data-runtime') === 'web-preview', 'Web Preview API marker is missing')
    assert(await page.locator('#root').isVisible(), 'React root is not visible')

    const input = page.locator('textarea').first()
    await input.fill('Hello, how are you?')
    await page.getByText('Xin chào, bạn khỏe không?', { exact: true }).waitFor({ timeout: 5_000 })
    assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join('; ')}`)

    console.log('Web Preview smoke test passed: render + deterministic translation')
  } finally {
    await browser.close()
  }
} finally {
  if (server) server.kill('SIGTERM')
}
