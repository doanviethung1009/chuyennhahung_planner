/**
 * A fixed test secret for the guest-key HMAC (ADR 0024), so every suite that
 * writes a guest review or report works without a developer environment file.
 * Tests that need a different or missing secret inject their own through
 * `guestKeySecret`, never by mutating this.
 */
process.env.GUEST_KEY_SECRET = 'test-guest-key-secret-0123456789abcdef';
