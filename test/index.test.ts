import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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
        test('layout is stable', async ({ page }) => {
            await page.goto(path)
            await expect(page.locator('h1')).toBeVisible()
            await expect(page).toHaveScreenshot(
                `route-${path.replace(/[/]/g, '_')}.png`,
                {
                    mask: [
                        // Hide dynamic elements
                        // (e.g., rotating carousels, ads, avatars)
                        page.locator('[data-dynamic]'),
                    ],
                })
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

// import { test } from '@substrate-system/tapzero'

// test('example', async t => {
//     t.ok('ok', 'should be an example')
// })
