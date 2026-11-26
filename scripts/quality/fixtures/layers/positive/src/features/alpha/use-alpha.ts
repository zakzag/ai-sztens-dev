/**
 * Positive layer fixture — a page's **own** feature. A feature may import
 * `entities`, `services`, `lib`, its own modules and the shared `api`
 * infrastructure feature.
 */
import { toItemLabel } from '../../entities/item/item.mapper.js';
import { format } from '../../lib/format.js';
import { loadItem } from '../../services/item-service.js';
import { useList } from '../api/use-list.js';
import { ALPHA_LABEL } from './alpha.const.js';

export function useAlpha(): string {
  return format(`${loadItem(toItemLabel(ALPHA_LABEL))}:${useList()}`);
}
