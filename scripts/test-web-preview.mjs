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

    const disabledSwap = page.locator('.translate-swap-control-disabled')
    await disabledSwap.waitFor()
    await disabledSwap.focus()
    assert(
      await page.locator('.translate-swap-tooltip').evaluate(
        element => getComputedStyle(element).visibility === 'visible',
      ),
      'Disabled language swap explanation is not keyboard discoverable',
    )

    for (const width of [1440, 800]) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(180)

      const translateLayout = await page.evaluate(() => {
        const main = document.querySelector('.app-main')
        const source = document.querySelector('.translate-source-pane')
        const result = document.querySelector('.translate-result-pane')
        const swapIcon = document.querySelector('.translate-swap-button svg')
        const resultFooter = document.querySelector('.translate-result-footer')
        const headings = Array.from(document.querySelectorAll('.translate-pane-heading'))
        if (!(main instanceof HTMLElement)
          || !(source instanceof HTMLElement)
          || !(result instanceof HTMLElement)
          || !(swapIcon instanceof SVGElement)
          || !(resultFooter instanceof HTMLElement)) return null

        const mainBounds = main.getBoundingClientRect()
        const sourceBounds = source.getBoundingClientRect()
        const resultBounds = result.getBoundingClientRect()
        const footerStyle = getComputedStyle(resultFooter)

        return {
          mainWidth: mainBounds.width,
          sourceTop: sourceBounds.top,
          sourceBottom: sourceBounds.bottom,
          resultTop: resultBounds.top,
          resultLeft: resultBounds.left,
          sourceLeft: sourceBounds.left,
          swapTransform: getComputedStyle(swapIcon).transform,
          resultFooterBorderColor: footerStyle.borderTopColor,
          resultFooterBorderStyle: footerStyle.borderTopStyle,
          resultFooterBorderWidth: Number.parseFloat(footerStyle.borderTopWidth),
          headingsVisible: headings.length === 2 && headings.every((heading) => {
            const bounds = heading.getBoundingClientRect()
            return bounds.width > 0 && bounds.height > 0 && getComputedStyle(heading).visibility === 'visible'
          }),
        }
      })

      assert(translateLayout !== null, `Translation layout is incomplete at ${width}px`)
      const shouldStack = translateLayout.mainWidth <= 899
      const isStacked = translateLayout.resultTop >= translateLayout.sourceBottom - 1
      const isSideBySide = Math.abs(translateLayout.resultTop - translateLayout.sourceTop) <= 1
        && translateLayout.resultLeft > translateLayout.sourceLeft

      assert(
        shouldStack ? isStacked : isSideBySide,
        `Translation panes do not match their container mode at ${width}px`,
      )
      assert(
        shouldStack
          ? translateLayout.swapTransform !== 'none'
          : translateLayout.swapTransform === 'none',
        `Language swap icon has the wrong orientation at ${width}px`,
      )
      assert(translateLayout.headingsVisible, `Translation pane headings are hidden at ${width}px`)
      assert(
        translateLayout.resultFooterBorderStyle === 'solid'
          && translateLayout.resultFooterBorderWidth >= 1
          && translateLayout.resultFooterBorderColor !== 'rgba(0, 0, 0, 0)',
        `Empty result footer divider is missing at ${width}px`,
      )
    }

    const input = page.locator('textarea').first()
    await input.fill('Hello, how are you?')
    await page.getByText('Xin chào, bạn khỏe không?', { exact: true }).waitFor({ timeout: 5_000 })

    for (const width of [1440, 800]) {
      await page.setViewportSize({ width, height: 900 })

      const compact = width < 900 ? 'true' : 'false'
      const sidebar = page.locator(
        `[data-sidebar-scope="primary"][data-responsive-compact="${compact}"]`,
      )
      await sidebar.waitFor()

      if (compact === 'true') {
        await page.locator('.primary-navigation-toggle').click()
        await page.locator('.primary-navigation-panel[data-overlay-open="true"]').waitFor()
      }

      await page.locator('.sidebar-bottom-group > .sidebar-nav-btn:last-child').click()

      const backdrop = page.locator('.modal-backdrop')
      await backdrop.waitFor()

      const settingsNavigationItems = page.locator('.settings-shell > aside .btn-nav-item')
      await settingsNavigationItems.first().waitFor()
      const settingsNavigationIsLeftAligned = await settingsNavigationItems.evaluateAll((items) => {
        const rows = items.map((item) => {
          const icon = item.querySelector('svg')
          const label = item.querySelector('span')
          if (!(item instanceof HTMLElement) || !icon || !(label instanceof HTMLElement)) return null

          const itemBounds = item.getBoundingClientRect()
          return {
            justifyContent: getComputedStyle(item).justifyContent,
            iconLeft: icon.getBoundingClientRect().left,
            iconInset: icon.getBoundingClientRect().left - itemBounds.left,
            labelLeft: label.getBoundingClientRect().left,
          }
        })

        if (rows.length === 0 || rows.some(row => row === null)) return false
        const metrics = rows.filter(row => row !== null)
        const spread = values => Math.max(...values) - Math.min(...values)

        return metrics.every(row => row.justifyContent === 'flex-start' && row.iconInset <= 24)
          && spread(metrics.map(row => row.iconLeft)) <= 1
          && spread(metrics.map(row => row.labelLeft)) <= 1
      })
      assert(
        settingsNavigationIsLeftAligned,
        `Settings navigation is not left-aligned at ${width}px`,
      )

      assert(
        await page.locator('.primary-navigation-panel[data-overlay-open="true"]').count() === 0,
        `Primary navigation overlay stayed open behind Settings at ${width}px`,
      )

      const modalCoversSidebar = await page.evaluate(() => {
        const navigation = document.querySelector('[data-sidebar-scope="primary"]')
        const modal = document.querySelector('.modal-backdrop')
        if (!(navigation instanceof HTMLElement) || !(modal instanceof HTMLElement)) return false

        const bounds = navigation.getBoundingClientRect()
        const topmostElement = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
        return topmostElement !== null && modal.contains(topmostElement)
      })

      assert(modalCoversSidebar, `Settings modal is below primary navigation at ${width}px`)

      await page.keyboard.press('Escape')
      await backdrop.waitFor({ state: 'detached' })
    }

    for (const width of [1440, 800]) {
      await page.setViewportSize({ width, height: 900 })
      if (width < 900) {
        const compactSidebar = page.locator(
          '[data-sidebar-scope="primary"][data-responsive-compact="true"]',
        )
        await compactSidebar.waitFor()
        await page.locator('.primary-navigation-toggle').click()
        await page.locator('.primary-navigation-panel[data-overlay-open="true"]').waitFor()
      }
      const appBodyHeightBefore = await page.locator('.app-body').evaluate(
        element => element.getBoundingClientRect().height,
      )

      await page.keyboard.press('Control+K')

      const palette = page.locator('.cmd-palette-panel')
      await palette.waitFor()
      await page.waitForTimeout(220)

      assert(
        await page.locator('.primary-navigation-panel[data-overlay-open="true"]').count() === 0,
        `Primary navigation overlay stayed open behind the command palette at ${width}px`,
      )

      assert(
        await palette.getAttribute('role') === 'dialog',
        `Command palette does not expose a dialog at ${width}px`,
      )
      assert(
        await page.locator('.cmd-palette-input').evaluate(element => element === document.activeElement),
        `Command palette search is not focused at ${width}px`,
      )

      const paletteLayout = await palette.evaluate((element) => {
        const backdrop = element.closest('.cmd-palette-backdrop')
        const firstItem = element.querySelector('.cmd-palette-item')
        const list = element.querySelector('.cmd-palette-list')
        if (!(backdrop instanceof HTMLElement)
          || !(firstItem instanceof HTMLElement)
          || !(list instanceof HTMLElement)) return null

        const viewport = { width: window.innerWidth, height: window.innerHeight }
        const backdropBounds = backdrop.getBoundingClientRect()
        const panelBounds = element.getBoundingClientRect()
        const itemBounds = firstItem.getBoundingClientRect()
        const backdropStyle = getComputedStyle(backdrop)
        const panelStyle = getComputedStyle(element)
        const itemStyle = getComputedStyle(firstItem)

        return {
          viewport,
          backdropBounds: {
            top: backdropBounds.top,
            left: backdropBounds.left,
            width: backdropBounds.width,
            height: backdropBounds.height,
          },
          panelBounds: {
            top: panelBounds.top,
            left: panelBounds.left,
            width: panelBounds.width,
            height: panelBounds.height,
          },
          itemWidth: itemBounds.width,
          backdropPosition: backdropStyle.position,
          panelDisplay: panelStyle.display,
          panelDirection: panelStyle.flexDirection,
          itemDisplay: itemStyle.display,
          listOverflowY: getComputedStyle(list).overflowY,
        }
      })

      assert(paletteLayout !== null, `Command palette layout is incomplete at ${width}px`)
      assert(
        paletteLayout.backdropPosition === 'fixed'
          && Math.abs(paletteLayout.backdropBounds.top) <= 1
          && Math.abs(paletteLayout.backdropBounds.left) <= 1
          && Math.abs(paletteLayout.backdropBounds.width - paletteLayout.viewport.width) <= 1
          && Math.abs(paletteLayout.backdropBounds.height - paletteLayout.viewport.height) <= 1,
        `Command palette backdrop does not cover the viewport at ${width}px`,
      )
      assert(
        paletteLayout.panelDisplay === 'flex'
          && paletteLayout.panelDirection === 'column'
          && paletteLayout.panelBounds.top > 40
          && paletteLayout.panelBounds.width >= 480
          && paletteLayout.panelBounds.width <= 560
          && paletteLayout.panelBounds.height >= 300
          && Math.abs(
            paletteLayout.panelBounds.left
              + paletteLayout.panelBounds.width / 2
              - paletteLayout.viewport.width / 2,
          ) <= 1,
        `Command palette panel is not a centered, bounded surface at ${width}px`,
      )
      assert(
        paletteLayout.itemDisplay.includes('flex')
          && paletteLayout.itemWidth >= paletteLayout.panelBounds.width - 32
          && paletteLayout.listOverflowY === 'auto',
        `Command palette result rows are not laid out correctly at ${width}px`,
      )
      assert(
        Math.abs(
          await page.locator('.app-body').evaluate(element => element.getBoundingClientRect().height)
            - appBodyHeightBefore,
        ) <= 1,
        `Command palette changed the application layout height at ${width}px`,
      )

      const search = page.locator('.cmd-palette-input')
      await search.fill('dictionary')
      const filteredItems = page.locator('.cmd-palette-item')
      assert(await filteredItems.count() === 1, `Command filtering failed at ${width}px`)
      assert(
        await filteredItems.first().getAttribute('data-command-id') === 'dictionary',
        `Command filtering returned the wrong result at ${width}px`,
      )

      await page.keyboard.press('Escape')
      await palette.waitFor({ state: 'detached' })
    }

    assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join('; ')}`)

    console.log('Web Preview smoke test passed: render + translation + modal layering + command palette')
  } finally {
    await browser.close()
  }
} finally {
  if (server) server.kill('SIGTERM')
}
