/**
 * The glass affordance (AIS-166).
 *
 * `backdrop-filter` is a property, not a token, so it cannot be switched by a
 * theme block: the floating-surface recipes carry `surface-glass`
 * unconditionally and the *tokens* decide whether it does anything (`0px` /
 * `100%` outside the glass appearance). This suite pins that topology, because a
 * new overlay that forgets the class would silently stay flat in the glass theme
 * while every other panel frosts.
 *
 * Blur is deliberately **not** on the scrolling page furniture: the card and the
 * table rows stay translucent-from-tokens but unblurred.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from '../src';
import { bannerVariants } from '../src/components/banner/banner.variants.js';
import { dialogVariants } from '../src/components/dialog/dialog.variants.js';
import { drawerVariants } from '../src/components/drawer/drawer.variants.js';
import { dropdownMenuContentVariants } from '../src/components/dropdown-menu/dropdown-menu.variants.js';
import {
  logDrawerPanelVariants,
  logDrawerTabVariants,
} from '../src/components/log-drawer/log-drawer.variants.js';
import { toastVariants } from '../src/components/toast/toast.variants.js';
import { tooltipVariants } from '../src/components/tooltip/tooltip.variants.js';
import { SURFACE_GLASS_CLASS } from '../src/theme/theme.const.js';

describe('surface-glass', () => {
  it('keeps one spelling of the utility class', () => {
    expect(SURFACE_GLASS_CLASS).toBe('surface-glass');
  });

  it('is carried by every floating-surface recipe', () => {
    const recipes: Readonly<Record<string, string>> = {
      banner: bannerVariants(),
      dialog: dialogVariants(),
      drawer: drawerVariants(),
      dropdownMenu: dropdownMenuContentVariants(),
      logDrawerHandle: logDrawerTabVariants(),
      logDrawerPanel: logDrawerPanelVariants(),
      // `SelectMenu` reuses the dropdown surface, so it is covered above.
      toast: toastVariants(),
      tooltip: tooltipVariants(),
    };

    for (const [name, classes] of Object.entries(recipes)) {
      expect(classes, name).toContain(SURFACE_GLASS_CLASS);
    }
  });

  it('is absent from the card surface', () => {
    // The table and card furniture sits inside the scrolling flow, where a
    // backdrop-filter per row is the known frame-cost worst case.
    const { container } = render(<Card>Tartalom</Card>);

    expect(container.firstElementChild?.className).not.toContain(
      SURFACE_GLASS_CLASS,
    );
  });
});
