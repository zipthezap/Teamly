/**
 * Guard against mutation of immutable fields in PATCH / PUT request bodies.
 *
 * Usage:
 *   guardImmutableFields(req.body, ['creatorId', 'groupId', 'sportType']);
 *
 * Throws a BadRequestError listing every immutable field that was found in the body.
 */

import { BadRequestError } from './errors';

/**
 * Throws a 400 BadRequestError if any of the supplied `immutableFields` are
 * present (even as `null` / `undefined`) in `body`.
 *
 * @param body     The parsed request body object.
 * @param immutableFields  Names of fields that must not be changed.
 */
export function guardImmutableFields(
  body: Record<string, unknown> | null | undefined,
  immutableFields: readonly string[]
): void {
  if (!body || typeof body !== 'object') return;

  const found = immutableFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));

  if (found.length > 0) {
    throw new BadRequestError(
      `The following fields cannot be changed after creation: ${found.join(', ')}`,
      'IMMUTABLE_FIELD',
      undefined,
      found
    );
  }
}
