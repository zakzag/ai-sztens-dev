/**
 * Constants of the shared entity-overlay feature (AIS-155).
 */

/**
 * `replace` mode of the close navigation.
 *
 * The overlay URL is a state of the list, not a page the user visited: pressing
 * "back" after closing a dialog must not re-open it (AIS-155 `D7`). Declared
 * here so the decision is visible and testable instead of hidden in a call.
 */
export const ENTITY_DIALOG_CLOSE_REPLACE = true;
