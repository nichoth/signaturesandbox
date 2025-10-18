import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT || 5173)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
    testDir: 'test',
    timeout: 45_000,
    fullyParallel: true,

    use: {
        baseURL: BASE_URL,
        // Keep things deterministic for visual snapshots
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        colorScheme: 'light',
        locale: 'en-US'
    },

    // Start your Vite dev server automatically before tests
    webServer: {
        command: `npx vite --port ${PORT} --no-open`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI, // reuse locally, fresh server in CI
        timeout: 120_000
    },

    // Run the same tests across viewports/devices
    projects: [
        { name: 'mobile', use: { ...devices['iPhone 12'] } },
        {
            name: 'tablet',
            use: { viewport: { width: 768, height: 1024 }, isMobile: false }
        },
        { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }
    ],

    reporter: [['list'], ['html', { open: 'never' }]]
})
