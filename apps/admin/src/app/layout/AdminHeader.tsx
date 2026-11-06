import { Button, SettingsIcon } from '@callback/ui';
import { Link } from 'react-router-dom';
import { APP_BRAND_LABEL, APP_ROUTE_HOME_PATH } from '../app.const.js';
import { AdminNav } from './AdminNav.js';
import { AppBreadcrumb } from './AppBreadcrumb.js';
import {
  ADMIN_HEADER_CRUMB_ROW_HEIGHT,
  ADMIN_HEADER_PADDING_X,
  ADMIN_HEADER_TOP_ROW_HEIGHT,
  ADMIN_HEADER_Z_INDEX,
  APP_USER_SETTINGS_ARIA_LABEL,
} from './layout.const.js';
import { ThemeSelector } from './ui/ThemeSelector.js';
import type { AdminHeaderProps } from './admin-header.interface.js';

/**
 * The two-band, sticky header of the admin shell (AIS-147).
 *
 * | Band | Left | Right |
 * | --- | --- | --- |
 * | `h-14` | brand link | appearance selector + user-settings button |
 * | `h-10` | navigation | breadcrumb |
 *
 * Three properties are contractual, not stylistic:
 *
 * - **sticky and fixed height** — the bands use the height constants, so
 *   scrolling can never shift the layout under the cursor;
 * - **`z-30`** — every overlay (log drawer `z-40`, dialog `z-50`, toast `z-60`)
 *   paints above the header (AIS-140 `D8`);
 * - **full bleed** — only the inner padding, no `max-w-*`, so the header and the
 *   `<main>` below share the same left edge (AIS-140 `D2`).
 *
 * The appearance selector and the user-settings button are deliberately **not
 * functional** yet: AIS-147 ships the UI contract, not the theming or the
 * settings screen (AIS-140 `D3` / `D4`). The settings button therefore has no
 * `onClick` and never navigates.
 *
 * @param props - see {@link AdminHeaderProps}.
 * @returns the sticky header.
 */
export function AdminHeader({ routes, onThemeChange }: AdminHeaderProps) {
  return (
    <header
      className={`sticky top-0 ${ADMIN_HEADER_Z_INDEX} border-b border-border-hairline bg-surface-raised`}
    >
      <div
        className={`flex ${ADMIN_HEADER_TOP_ROW_HEIGHT} ${ADMIN_HEADER_PADDING_X} items-center justify-between gap-6`}
      >
        <Link
          to={APP_ROUTE_HOME_PATH}
          className="text-lg font-semibold text-text-primary"
        >
          {APP_BRAND_LABEL}
        </Link>

        <div className="flex items-center gap-4">
          <ThemeSelector onThemeChange={onThemeChange} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={APP_USER_SETTINGS_ARIA_LABEL}
          >
            <SettingsIcon />
          </Button>
        </div>
      </div>

      <div
        className={`flex ${ADMIN_HEADER_CRUMB_ROW_HEIGHT} ${ADMIN_HEADER_PADDING_X} items-center justify-between gap-6 border-t border-border-hairline`}
      >
        <AdminNav routes={routes} />
        <AppBreadcrumb routes={routes} />
      </div>
    </header>
  );
}
