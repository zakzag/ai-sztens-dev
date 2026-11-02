/**
 * Positive layer fixture — a page may import its **own** feature plus the
 * shared infra features, `entities`, `components` and `lib`.
 */
import { Card } from '../../components/Card.js';
import { toItemLabel } from '../../entities/item/item.mapper.js';
import { useAlpha } from '../../features/alpha/use-alpha.js';
import { useList } from '../../features/api/use-list.js';
import { format } from '../../lib/format.js';

export function AlphaPage() {
  return (
    <Card title={format(`${useAlpha()}${useList()}${toItemLabel('x')}`)} />
  );
}
