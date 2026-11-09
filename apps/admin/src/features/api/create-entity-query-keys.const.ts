/**
 * Segment constants of the entity query-key factory (AIS-175).
 *
 * The two literals are declared once so a typo cannot appear in one builder but
 * not the other. They are also what a log or a devtools entry shows between the
 * namespace and the payload, so they are part of the observable contract.
 */

/** Segment of a list query key: `[namespace, 'list', params]`. */
export const ENTITY_QUERY_LIST_SEGMENT = 'list' as const;

/** Segment of a detail query key: `[namespace, 'detail', identifier]`. */
export const ENTITY_QUERY_DETAIL_SEGMENT = 'detail' as const;
