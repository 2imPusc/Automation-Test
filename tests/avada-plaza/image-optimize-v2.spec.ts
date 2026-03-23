/**
 * Avada Plaza - Image Optimize v2 Regression Tests
 *
 * Covers changes introduced in [App plaza] Image Optimize v2:
 *  - ButtonOptimize: removed shouldConfirm / openModal / closeModal props
 *    → optimization now triggers directly, NO confirmation modal
 *  - Verifies core optimize flows still work correctly after the refactor
 *
 * Store: ag-chan-seoon-image-otm-111 (staging)
 * Run:   npx playwright test tests/avada-plaza/image-optimize-v2.spec.ts --headed
 */
import { test, expect } from '../../fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// TC01 — No confirmation modal on "Optimize all" (v2 regression)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Image Optimize v2 — No confirmation modal', () => {
  test(
    'Optimize all: no modal appears, optimization starts immediately @smoke',
    async ({ imageManager }) => {
      await test.step('Click Optimize now to open panel', async () => {
        await imageManager.clickOptimizeNow();
        console.log('✅ Optimize now panel opened');
      });

      await test.step('Click Optimize all', async () => {
        await imageManager.clickOptimizeAll();
        console.log('✅ Optimize all clicked');
      });

      await test.step('Confirm NO confirmation modal appears', async () => {
        const modal = imageManager.frame.locator('[role="dialog"]');
        // In v2, shouldConfirm / openModal were removed — dialog must NOT appear
        await expect(modal).toBeHidden({ timeout: 3000 });
        console.log('✅ No confirmation modal — v2 behaviour confirmed');
      });

      await test.step('Verify optimization starts (toast or progress visible)', async () => {
        await expect(imageManager.toast.or(imageManager.progress))
          .toBeVisible({ timeout: 15000 });
        console.log('✅ Optimization started — toast/progress visible');
      });
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC02 — "Optimize unoptimized" also starts without modal
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Image Optimize v2 — Optimize unoptimized flow', () => {
  test(
    'Optimize unoptimized: triggers directly, no modal, toast appears',
    async ({ imageManager }) => {
      await test.step('Click Optimize now to open panel', async () => {
        await imageManager.clickOptimizeNow();
      });

      await test.step('Click Optimize unoptimized', async () => {
        await imageManager.frame
          .getByRole('button', { name: 'Optimize unoptimized' })
          .click();
        console.log('✅ Optimize unoptimized clicked');
      });

      await test.step('Confirm no modal is shown', async () => {
        const modal = imageManager.frame.locator('[role="dialog"]');
        await expect(modal).toBeHidden({ timeout: 3000 });
        console.log('✅ No confirmation modal shown');
      });

      await test.step('Toast or progress appears confirming job started', async () => {
        await expect(imageManager.toast.or(imageManager.progress))
          .toBeVisible({ timeout: 15000 });
        console.log('✅ Optimization feedback visible');
      });
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC03 — Manual compress: single image, no modal, toast success
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Image Optimize v2 — Manual compress (single image)', () => {
  test(
    'Select image → Compress image → no modal → "Image optimized successfully" toast',
    async ({ imageManager }) => {
      await test.step('Switch to manual mode', async () => {
        await imageManager.switchToManualMode();
        console.log('✅ Switched to manual compress mode');
      });

      await test.step('Select first image', async () => {
        await imageManager.selectFirstImage();
        console.log('✅ First image selected');
      });

      await test.step('Click Compress image', async () => {
        await imageManager.clickCompressImage();
        console.log('✅ Compress image clicked');
      });

      await test.step('Confirm no confirmation modal appears', async () => {
        const modal = imageManager.frame.locator('[role="dialog"]');
        await expect(modal).toBeHidden({ timeout: 3000 });
        console.log('✅ No modal — direct compress triggered (v2)');
      });

      await test.step('Toast "Image optimized successfully" appears', async () => {
        await expect(
          imageManager.frame.getByText('Image optimized successfully')
        ).toBeVisible({ timeout: 60000 });
        console.log('✅ Success toast shown');
      });
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC04 — Image Manager statistics load correctly (smoke/sanity)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Image Optimize v2 — Stats panel sanity', () => {
  test(
    'Image Manager loads all statistics labels @smoke',
    async ({ imageManager }) => {
      await test.step('Assert stat labels are visible', async () => {
        await expect(imageManager.frame.getByText('Total images')).toBeVisible();
        await expect(imageManager.frame.getByText('Original size')).toBeVisible();
        await expect(imageManager.frame.getByText('Optimized size')).toBeVisible();
        await expect(imageManager.frame.getByText('Size saved')).toBeVisible();
        console.log('✅ All statistics labels present');
      });

      await test.step('Assert Optimize now CTA is present', async () => {
        await expect(imageManager.frame.getByText('Optimize now')).toBeVisible();
        console.log('✅ Optimize now button visible');
      });
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC05 — Compress button disabled when no image is selected (manual mode)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Image Optimize v2 — Manual mode guard', () => {
  test(
    'No image selected → Compress image button is disabled',
    async ({ imageManager }) => {
      await test.step('Switch to manual mode', async () => {
        await imageManager.switchToManualMode();
      });

      await test.step('Verify Compress image is disabled with no selection', async () => {
        await expect(imageManager.compressButton).toBeVisible({ timeout: 10000 });
        await expect(imageManager.compressButton).toBeDisabled();
        console.log('✅ Compress button correctly disabled — no selection');
      });
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TC06 — Cooldown warning shown when optimizing too soon after previous run
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Image Optimize v2 — Cooldown / rate-limit guard', () => {
  test(
    'Second optimize attempt within 30 min shows cooldown warning',
    async ({ imageManager }) => {
      await test.step('First optimize — start optimization', async () => {
        await imageManager.clickOptimizeNow();
        await imageManager.clickOptimizeAll();
        // Wait for toast/progress to confirm first attempt registered
        await expect(imageManager.toast.or(imageManager.progress))
          .toBeVisible({ timeout: 15000 });
        console.log('✅ First optimize triggered');
      });

      await test.step('Second optimize attempt immediately after', async () => {
        await imageManager.clickOptimizeNow();
        await imageManager.clickOptimizeAll();
        console.log('✅ Second optimize attempt clicked');
      });

      await test.step('Cooldown warning banner or toast is shown', async () => {
        const cooldownMsg = imageManager.frame.getByText(
          /Please wait.*(30 minutes|before optimizing)/i
        );
        await expect(cooldownMsg).toBeVisible({ timeout: 10000 });
        console.log('✅ Cooldown warning displayed correctly');
      });
    }
  );
});
