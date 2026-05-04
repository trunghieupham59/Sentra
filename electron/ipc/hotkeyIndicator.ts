import { BrowserWindow, nativeTheme, screen } from 'electron'

type HotkeyIndicatorState = 'busy' | 'copying' | 'translating' | 'done' | 'warning' | 'error'

const INDICATOR_WIDTH = 320
const INDICATOR_HEIGHT = 76
const INDICATOR_TOP_MARGIN = 28
const DEFAULT_HIDE_DELAY_MS = 1_500

let indicatorWindow: BrowserWindow | null = null
let hideTimer: NodeJS.Timeout | null = null

function buildIndicatorHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      user-select: none;
    }

    body {
      display: grid;
      place-items: center;
      padding: 8px;
    }

    .pill {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: #172033;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(45, 83, 173, 0.16);
      border-radius: 8px;
      box-shadow: 0 16px 44px rgba(15, 23, 42, 0.22), 0 2px 8px rgba(15, 23, 42, 0.10);
      transform: translateY(8px) scale(0.98);
      opacity: 0;
      animation: enter 160ms ease-out forwards;
    }

    .mark {
      position: relative;
      width: 34px;
      height: 34px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      color: #fff;
      background: linear-gradient(135deg, #1769e6, #10b981);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 800;
    }

    .mark::after {
      content: "";
      position: absolute;
      inset: -4px;
      border: 2px solid rgba(23, 105, 230, 0.34);
      border-radius: 11px;
      animation: pulse 900ms ease-out infinite;
    }

    .content {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.2;
    }

    .message {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #64748b;
      font-size: 12px;
      line-height: 1.25;
    }

    body[data-state="done"] .mark {
      background: linear-gradient(135deg, #0f9f6e, #14b8a6);
    }

    body[data-state="done"] .mark::after,
    body[data-state="warning"] .mark::after,
    body[data-state="error"] .mark::after {
      animation: none;
      opacity: 0.32;
    }

    body[data-state="warning"] .mark {
      background: linear-gradient(135deg, #d97706, #f59e0b);
    }

    body[data-state="error"] .mark {
      background: linear-gradient(135deg, #dc2626, #f43f5e);
    }

    @keyframes enter {
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes pulse {
      0% {
        opacity: 0.64;
        transform: scale(0.84);
      }
      100% {
        opacity: 0;
        transform: scale(1.22);
      }
    }

    @media (prefers-color-scheme: dark) {
      .pill {
        color: #f8fafc;
        background: rgba(15, 23, 42, 0.92);
        border-color: rgba(148, 163, 184, 0.22);
        box-shadow: 0 16px 44px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.18);
      }

      .message {
        color: #cbd5e1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .pill, .mark::after {
        animation: none;
      }

      .pill {
        opacity: 1;
        transform: none;
      }
    }
  </style>
</head>
<body data-state="copying">
  <div class="pill" role="status" aria-live="polite">
    <div class="mark" id="mark">V</div>
    <div class="content">
      <div class="title" id="title">Dịch nhanh</div>
      <div class="message" id="message">Đang nhận phím tắt...</div>
    </div>
  </div>
  <script>
    window.setHotkeyIndicator = function (state, title, message, mark) {
      document.body.dataset.state = state;
      document.getElementById('title').textContent = title;
      document.getElementById('message').textContent = message;
      document.getElementById('mark').textContent = mark;
    };
  </script>
</body>
</html>`
}

function createIndicatorWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.setAlwaysOnTop(true, 'pop-up-menu')
  win.setIgnoreMouseEvents(true)
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildIndicatorHtml())}`)
  win.on('closed', () => {
    indicatorWindow = null
  })

  return win
}

function getIndicatorWindow(): BrowserWindow {
  if (!indicatorWindow || indicatorWindow.isDestroyed()) {
    indicatorWindow = createIndicatorWindow()
  }
  return indicatorWindow
}

function positionIndicatorWindow(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(cursor)

  win.setBounds({
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    x: Math.round(workArea.x + workArea.width / 2 - INDICATOR_WIDTH / 2),
    y: Math.round(workArea.y + INDICATOR_TOP_MARGIN),
  })
}

function getIndicatorCopy(state: HotkeyIndicatorState, message?: string): { title: string; message: string; mark: string } {
  switch (state) {
    case 'busy':
      return { title: 'Dịch nhanh', message: message ?? 'Đang xử lý yêu cầu trước...', mark: 'V' }
    case 'copying':
      return { title: 'Dịch nhanh', message: message ?? 'Đang lấy văn bản đang chọn...', mark: 'V' }
    case 'translating':
      return { title: 'Dịch nhanh', message: message ?? 'Đang dịch và chuẩn bị thay thế...', mark: 'V' }
    case 'done':
      return { title: 'Dịch nhanh', message: message ?? 'Đã thay thế văn bản.', mark: '✓' }
    case 'warning':
      return { title: 'Dịch nhanh', message: message ?? 'Không có văn bản được chọn.', mark: '!' }
    case 'error':
      return { title: 'Dịch nhanh', message: message ?? 'Không thể dịch văn bản.', mark: '!' }
  }
}

export function showHotkeyIndicator(
  state: HotkeyIndicatorState,
  message?: string,
  hideAfterMs?: number
): void {
  const win = getIndicatorWindow()
  const copy = getIndicatorCopy(state, message)

  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  positionIndicatorWindow(win)

  const prefersDark = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'

  const applyState = () => {
    if (win.isDestroyed()) return
    win.webContents.executeJavaScript(
      `document.documentElement.style.colorScheme = ${JSON.stringify(prefersDark)};` +
      `window.setHotkeyIndicator(${JSON.stringify(state)}, ${JSON.stringify(copy.title)}, ${JSON.stringify(copy.message)}, ${JSON.stringify(copy.mark)});`,
      true
    ).catch(() => undefined)
  }

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', applyState)
  } else {
    applyState()
  }

  win.showInactive()

  if (typeof hideAfterMs === 'number') {
    hideTimer = setTimeout(() => {
      if (!win.isDestroyed()) win.close()
      hideTimer = null
    }, hideAfterMs)
  }
}

export function hideHotkeyIndicator(delayMs = DEFAULT_HIDE_DELAY_MS): void {
  if (!indicatorWindow || indicatorWindow.isDestroyed()) return
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (indicatorWindow && !indicatorWindow.isDestroyed()) indicatorWindow.close()
    hideTimer = null
  }, delayMs)
}
