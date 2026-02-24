/** Match canonical RFC 4122 UUID v4 strings. */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check whether a string is a valid UUID v4.
 *
 * @param value Candidate UUID string.
 * @returns Returns `true` when the value is a valid UUID v4.
 */
export function isUuidV4(value: string) {
  return UUID_V4_REGEX.test(value);
}

/**
 * Assert that a string is a valid UUID v4.
 *
 * @param value Candidate UUID string.
 * @param context Human-readable label for error messages.
 * @returns Returns the validated UUID v4 string.
 */
export function assertUuidV4(value: string, context: string) {
  if (!isUuidV4(value)) {
    throw new Error(`Expected ${context} to be a valid UUIDv4, received '${value}'.`);
  }

  return value;
}
