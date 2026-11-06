import { Breadcrumb } from '@callback/ui';
import type { BreadcrumbLinkRenderer } from '@callback/ui';
import { Link, useLocation } from 'react-router-dom';
import { toBreadcrumbItems } from '../router/breadcrumb.logic.js';
import type { AppBreadcrumbProps } from './app-breadcrumb.interface.js';

/**
 * Turns a crumb target into an SPA link.
 *
 * Declared at module scope on purpose: a new function identity per render would
 * remount every link on each navigation, and a `useCallback` would buy nothing
 * here because the function depends on no value.
 *
 * @param props - see {@link BreadcrumbLinkRenderer}.
 * @returns the router link element.
 */
const ROUTER_LINK_RENDERER: BreadcrumbLinkRenderer = ({ to, children }) => (
  <Link to={to}>{children}</Link>
);

/**
 * The breadcrumb region of the admin shell.
 *
 * It is deliberately thin: the pathname comes from the router, the trail comes
 * from the pure {@link toBreadcrumbItems}, and the rendering is the
 * router-agnostic `Breadcrumb` primitive of `@callback/ui` with the router
 * `Link` injected (AIS-145 + AIS-146).
 *
 * The params of a dynamic route are **not** read with `useParams()`: this
 * component renders inside the layout, i.e. inside `<Route path="/*">`, where
 * `useParams()` would only expose the splat. The matched pattern supplies them
 * instead (AIS-146 `D4`).
 *
 * An unknown URL produces no crumbs, and the primitive then renders no
 * navigation landmark at all.
 *
 * @param props - see {@link AppBreadcrumbProps}.
 * @returns the breadcrumb trail, or `null` when there is none.
 */
export function AppBreadcrumb({ routes }: AppBreadcrumbProps) {
  const { pathname } = useLocation();

  return (
    <Breadcrumb
      items={toBreadcrumbItems(routes, pathname)}
      renderLink={ROUTER_LINK_RENDERER}
    />
  );
}
