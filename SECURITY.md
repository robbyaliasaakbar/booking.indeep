# Security Policy

## This repository vs the live system

This is the full source of **App InDeep Booking**, a real booking system that serves
paying customers. The repository is published for review purposes and is kept free
of secrets by design:

- **No credentials in git.** Database, SMTP, and Google OAuth credentials live only
  on the server (`config/config.php`, git-ignored) or in local environment files
  (`web/.env*`, git-ignored).
- **No default passwords.** Seeding requires `SEED_ADMIN_USERNAME` /
  `SEED_ADMIN_PASSWORD` values you set yourself — the repository ships no defaults.
- **No customer data.** No PII (names, addresses, phone numbers, bookings) exists in
  this repository, its migrations, or its test fixtures. Test data uses `@test.dev`.
- **No uploads.** User-uploaded files never live in git (`public/uploads/` is ignored;
  only a 404 guard file is tracked).

## Reporting a vulnerability

Found something? Please report it **responsibly**:

1. Contact the maintainer via GitHub (`@robbyaliasaakbar`) — do **not** open a
   public issue for exploitable vulnerabilities.
2. Include steps to reproduce, if you have them.
3. You'll get an acknowledgement within 72 hours.

## Scope note

The live deployment serves real customers and real data. Please don't run active
scans or exploit attempts against production without prior arrangement — testing
against your own local instance is always welcome.

---

© 2026 Robby. Proprietary — source available for inspection, see [LICENSE](LICENSE).
