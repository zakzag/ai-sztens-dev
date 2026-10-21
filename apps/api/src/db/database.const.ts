/**
 * NestJS injection token for the {@link Database} handle.
 *
 * A string token is used instead of the class as a token because `Database` is
 * a type alias, not a runtime value — there is no class to inject by type.
 * Keeping the token in its own constants file (coding standards → *constants go
 * in `.const.ts`*) means the provider (AIS-38) and every consumer import the
 * same symbol, so a typo cannot silently create a second, unresolved token.
 */
export const DATABASE = 'DRIZZLE_DATABASE';
