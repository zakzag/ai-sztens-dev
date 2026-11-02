/**
 * Positive layer fixture — a page's **own** feature. A feature may import
 * `entities`, `services`, `lib` and its own modules.
 */
import { toItemLabel } from '../../entities/item/item.mapper.js';
import { format } from '../../lib/format.js';
import { loadItem } from '../../services/item-service.js';
import { ALPHA_LABEL } from './alpha.const.js';

export function useAlpha(): string {
  return format(loadItem(toItemLabel(ALPHA_LABEL)));
}
