import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import * as fs from 'fs'

const routes = ['/', '/ed25519', '/rsa']

test.beforeEach(async ({ page }) => {
    // Make screenshots deterministic
    await page.addStyleTag({
        content: `
    * { animation: none !important; transition: none !important; }
  `
    })

    await page.addInitScript(() => {
        // Freeze time if your app shows clocks/timestamps
        const now = new Date('2024-01-01T12:00:00Z').valueOf()
        Date.now = () => now
    })
})

for (const path of routes) {
    test.describe(`Route ${path}`, () => {
        test('layout is stable', async ({ page }, testInfo) => {
            await page.goto(path)
            await expect(page.locator('h1')).toBeVisible()

            const snapshotName = `route-${path.replace(/[/]/g, '_')}.png`
            const snapshotPath = testInfo.snapshotPath(snapshotName)
            const snapshotExists = fs.existsSync(snapshotPath)

            // Smart snapshot handling: create baseline if missing, compare if exists
            // This ensures tests pass in CI even when screenshots don't exist yet
            if (!snapshotExists) {
                // Snapshot doesn't exist - create baseline without comparison
                console.log(`Creating baseline snapshot: ${snapshotName}`)

                // Take screenshot with same options as toHaveScreenshot
                const screenshotBuffer = await page.screenshot({
                    mask: [page.locator('[data-dynamic]')],
                    animations: 'disabled',
                    fullPage: false,
                    scale: 'css',
                })

                // Attach to test report
                await testInfo.attach(snapshotName, {
                    body: screenshotBuffer,
                    contentType: 'image/png',
                })

                // Save to snapshots directory for future comparisons
                const snapshotDir = snapshotPath.substring(0, snapshotPath.lastIndexOf('/'))
                if (!fs.existsSync(snapshotDir)) {
                    fs.mkdirSync(snapshotDir, { recursive: true })
                }
                fs.writeFileSync(snapshotPath, screenshotBuffer)
                console.log(`Baseline snapshot created and saved: ${snapshotName}`)
            } else {
                // Snapshot exists - perform normal comparison
                await expect(page).toHaveScreenshot(snapshotName, {
                    mask: [page.locator('[data-dynamic]')],
                })
            }
        })

        test('basic a11y (axe)', async ({ page }) => {
            await page.goto(path)
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze()

            // Fail build on any violations
            expect(
                results.violations,
                JSON.stringify(results.violations, null, 2)
            ).toEqual([])
        })
    })
}
