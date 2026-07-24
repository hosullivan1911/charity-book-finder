/**
 * One-time owner bootstrap.
 *
 * The corresponding setup code is held by the project owner and is never
 * committed. Once the first owner account exists, the setup endpoint closes.
 */
export const OWNER_SETUP_CODE_SHA256 =
  "497cb43f752a3eebbd5a46215bcba7d1722d22b90d4cd562e96e3483e0a9b662";

/**
 * Changing this key deliberately performs one guarded launch-data reset.
 * It removes test users, sessions, invitations, books and inventory while
 * preserving the configured shop records.
 */
export const LAUNCH_DATA_RESET_KEY = "launch-reset-2026-07-24-v1";

