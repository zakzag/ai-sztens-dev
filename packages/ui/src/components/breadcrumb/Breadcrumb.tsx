import { Fragment } from 'react';
import { ChevronRightIcon } from '../icon/icons.js';
import {
  BREADCRUMB_CURRENT_CLASSES,
  BREADCRUMB_DEFAULT_ARIA_LABEL,
  BREADCRUMB_LINK_CLASSES,
  BREADCRUMB_LIST_CLASSES,
  BREADCRUMB_SEPARATOR_CLASSES,
  BREADCRUMB_STATIC_CLASSES,
} from './breadcrumb.const.js';
import type {
  BreadcrumbItem,
  BreadcrumbLinkRenderer,
  BreadcrumbProps,
} from './breadcrumb.interface.js';

/**
 * One crumb's content — the only branch in the primitive.
 *
 * @param item - the crumb to render.
 * @param isCurrent - `true` for the last crumb, which is never a link.
 * @param renderLink - optional link factory supplied by the caller.
 */
function renderCrumb(
  item: BreadcrumbItem,
  isCurrent: boolean,
  renderLink?: BreadcrumbLinkRenderer,
) {
  if (isCurrent) {
    return (
      <span aria-current="page" className={BREADCRUMB_CURRENT_CLASSES}>
        {item.label}
      </span>
    );
  }

  if (item.to === undefined) {
    return <span className={BREADCRUMB_STATIC_CLASSES}>{item.label}</span>;
  }

  if (renderLink) {
    return renderLink({ to: item.to, children: item.label });
  }

  return (
    <a href={item.to} className={BREADCRUMB_LINK_CLASSES}>
      {item.label}
    </a>
  );
}

/**
 * Router-free breadcrumb trail.
 *
 * Renders `<nav aria-label> → <ol> → <li>` cells with `n-1` decorative
 * separators. The link element is **injected** through `renderLink`, so
 * `packages/ui` never depends on a router; without it a crumb with a `to`
 * falls back to a plain `<a href>` (a full page navigation).
 *
 * Contracts worth knowing:
 * - the **last** crumb is always a `<span aria-current="page">`, never a link;
 * - a non-last crumb without `to` renders as plain text, never as a dead link;
 * - separators are `<li aria-hidden="true">` cells, so `n` crumbs produce
 *   `2n-1` list items;
 * - an empty `items` array renders **nothing** — no empty navigation landmark.
 *
 * @param props - see {@link BreadcrumbProps}.
 */
export function Breadcrumb({ items, ariaLabel, renderLink }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={ariaLabel ?? BREADCRUMB_DEFAULT_ARIA_LABEL}>
      <ol className={BREADCRUMB_LIST_CLASSES}>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <Fragment key={`${index}-${item.label}`}>
              <li>{renderCrumb(item, isCurrent, renderLink)}</li>
              {isCurrent ? null : (
                <li aria-hidden="true" className={BREADCRUMB_SEPARATOR_CLASSES}>
                  <ChevronRightIcon />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
