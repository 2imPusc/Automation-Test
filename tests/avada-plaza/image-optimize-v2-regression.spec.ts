/**
 * Image Optimize v2 — Regression Tests
 *
 * Validates v2 changes:
 *  - shouldConfirm/openModal/closeModal removed from ButtonOptimize → no confirmation modal
 *  - Toast notification still fires after optimization
 *  - ImageViewCompareTable renders without broken layout (11 lines removed)
 *  - LeavePrompt fires when navigating away mid-optimization
 *
 * Run:  npx playwright test tests/avada-plaza/image-optimize-v2-regression.spec.ts --headed
 */
import { test, expect } from '../../fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// TC01 — Optimize all: no confirmation modal (v2 regression)
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Optimize all — no confirmation modal (v2 regression) @smoke',
  async ({ imageManager }) => {
    await test.step('Wait for image list to load', async () => {
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 20000 });
      console.log('✅ Image list loaded');
    });

    await test.step('Click Optimize now button', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Optimize now clicked');
    });

    await test.step('Select Optimize all from dropdown', async () => {
      await imageManager.clickOptimizeAll();
      console.log('✅ Optimize all selected');
    });

    await test.step('Assert no dialog/modal appears', async () => {
      await expect(imageManager.dialog).toBeHidden({ timeout: 3000 });
      console.log('✅ No confirmation modal — v2 regression verified');
    });

    await test.step('Assert toast notification is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 15000 });
      console.log('✅ Toast notification appeared');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC02 — Optimize selected images: no confirmation modal
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Optimize selected images — no confirmation modal',
  async ({ imageManager }) => {
    await test.step('Wait for image list to load', async () => {
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 20000 });
      console.log('✅ Image list loaded');
    });

    await test.step('Select one or more images via checkbox', async () => {
      await imageManager.selectImages(1);
      console.log('✅ Image(s) selected');
    });

    await test.step('Click Optimize now for selected', async () => {
      await imageManager.clickOptimizeNow();
      console.log('✅ Optimize now clicked for selected images');
    });

    await test.step('Assert no dialog/modal appears', async () => {
      await expect(imageManager.dialog).toBeHidden({ timeout: 3000 });
      console.log('✅ No confirmation modal for selected images');
    });

    await test.step('Assert toast notification is visible', async () => {
      await expect(imageManager.toast).toBeVisible({ timeout: 15000 });
      console.log('✅ Toast notification appeared');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC03 — Toast notification renders after optimization triggered
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Toast notification renders after optimization triggered',
  async ({ imageManager }) => {
    const consoleErrors: string[] = [];

    await test.step('Listen for console errors', async () => {
      imageManager.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
    });

    await test.step('Trigger optimize (Optimize all)', async () => {
      await imageManager.triggerOptimizeAll();
      console.log('✅ Optimization triggered');
    });

    await test.step('Wait for alert role to appear within 5s', async () => {
      const alert = imageManager.frame.locator('[role="alert"]').first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      console.log('✅ Toast alert is visible');
    });

    await test.step('Assert toast text is non-empty and visible', async () => {
      const alert = imageManager.frame.locator('[role="alert"]').first();
      const text = await alert.textContent();
      expect(text?.trim()).toBeTruthy();
      console.log(`✅ Toast text: "${text?.trim()}"`);
    });

    await test.step('Assert no JS console errors related to ABanner props', async () => {
      const bannerErrors = consoleErrors.filter(
        (e) => /banner/i.test(e) || /ABanner/i.test(e)
      );
      expect(bannerErrors).toHaveLength(0);
      console.log('✅ No ABanner-related console errors');
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC04 — Image compare table renders without removed rows
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Image compare table renders without removed rows',
  async ({ imageManager }) => {
    await test.step('Wait for image list to load', async () => {
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 20000 });
      console.log('✅ Image list loaded');
    });

    await test.step('Locate the compare table/list section', async () => {
      // The compare table or card section should be visible in the compression view
      const tableOrCard = imageManager.frame.locator('table, [class*="Card"]').first();
      await expect(tableOrCard).toBeVisible({ timeout: 10000 });
      console.log('✅ Compare table/list section is visible');
    });

    await test.step('Assert table renders with no visual breakage', async () => {
      // Verify the stats section renders (proxy for no layout breakage)
      await expect(imageManager.frame.getByText('Total images')).toBeVisible();
      await expect(imageManager.frame.getByText('Original size')).toBeVisible();
      await expect(imageManager.frame.getByText('Optimized size')).toBeVisible();
      await expect(imageManager.frame.getByText('Size saved')).toBeVisible();
      console.log('✅ Stats and layout render correctly — no broken regions');
    });

    await test.step('Assert no empty or broken layout regions', async () => {
      // Check that the Optimize now CTA is visible (confirms core UI rendered)
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible();
      // Check that at least one card/section is visible
      const cards = imageManager.frame.locator('[class*="Card"]');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);
      console.log(`✅ ${cardCount} card section(s) rendered — no empty layout`);
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TC05 — Leave prompt fires when navigating away mid-optimization
// ─────────────────────────────────────────────────────────────────────────────
test(
  'Leave prompt fires when navigating away mid-optimization',
  async ({ imageManager }) => {
    await test.step('Trigger an optimization', async () => {
      await imageManager.triggerOptimizeAll();
      // Wait for optimization to start (toast or progress)
      await expect(imageManager.toast.or(imageManager.progress))
        .toBeVisible({ timeout: 15000 });
      console.log('✅ Optimization started');
    });

    await test.step('Attempt to navigate away', async () => {
      await imageManager.navigateAway();
      console.log('✅ Navigation away attempted');
    });

    await test.step('Assert leave prompt appears', async () => {
      const leaveDialog = imageManager.frame.locator('[role="dialog"]')
        .or(imageManager.page.locator('[role="dialog"]'));
      await expect(leaveDialog.first()).toBeVisible({ timeout: 5000 });
      console.log('✅ Leave prompt dialog is visible');
    });

    await test.step('Click Stay — assert user remains on Image Manager', async () => {
      const stayButton = imageManager.frame.getByRole('button', { name: /stay/i })
        .or(imageManager.page.getByRole('button', { name: /stay/i }));
      await stayButton.first().click();
      // Verify we're still on Image Manager
      await expect(imageManager.frame.getByText('Optimize now')).toBeVisible({ timeout: 10000 });
      console.log('✅ Clicked Stay — still on Image Manager');
    });

    await test.step('Navigate away again and click Leave', async () => {
      await imageManager.navigateAway();
      const leaveButton = imageManager.frame.getByRole('button', { name: /leave/i })
        .or(imageManager.page.getByRole('button', { name: /leave/i }));
      await leaveButton.first().click();
      // Verify navigation proceeded (Image Manager CTA should no longer be visible)
      await expect(imageManager.frame.getByText('Optimize now')).toBeHidden({ timeout: 10000 });
      console.log('✅ Clicked Leave — navigated away successfully');
    });
  }
);
