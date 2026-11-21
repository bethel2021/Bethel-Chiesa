# Bethel Church CMS Security Specification

## 1. Data Invariants
1. Public CMS collections (`church_sections`, `pastors`, `coworkers`, `worship_times`, `liturgy_steps`, `worship_songs`, `ministry_roster`, `weekday_ministries`, `announcements`) are publicly readable (`get` and `list`) so visitors can browse the church homepage without signing in.
2. Only verified admins (`isAdmin()`, defined as `email_verified == true && (email == 'chinarenzhian@gmail.com' || exists(/databases/$(database)/documents/admins/$(request.auth.uid)))`) can create, update, or delete any CMS document.
3. All CMS writes must pass strict `isValid*` schema validation (required keys, `hasOnly` allowlist, string length bounds, bounded list sizes, valid enums, and `updatedAt == request.time`). Image references allow only safe relative/HTTP(S) paths or bounded JPEG/PNG/WebP base64 data URIs (SVG/script URIs are rejected).
4. `visitor_requests` contains visitor PII (name, phone/email, message). Public visitors may `create` a request only with `status == 'pending'`, no `adminNote`, and `createdAt == request.time`. Public users and non-admin signed-in users CANNOT `get`, `list`, `update`, or `delete` any `visitor_requests` document.
5. `admins` collection is readable and writable exclusively by verified admins (`isAdmin()`). Unauthenticated or non-admin users cannot escalate privileges or enumerate admin accounts.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Unauthenticated CMS Write**: Attempt `create` on `/announcements/hack1` without `request.auth` -> `PERMISSION_DENIED`.
2. **Non-Admin Authenticated CMS Write**: Attempt `update` on `/pastors/pastor-lin` signed in as `guest@example.com` -> `PERMISSION_DENIED`.
3. **Unverified Admin Email Spoof**: Attempt `create` on `/announcements/spoof` with `email: 'chinarenzhian@gmail.com'` and `email_verified: false` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Announcement**: Admin attempts `create` on `/announcements/test1` including an extra ghost field `ghostFlag: true` -> `PERMISSION_DENIED` (`hasOnly` rejection).
5. **ID Poisoning Attack**: Admin attempts `create` on `/pastors/bad$id!@#` with invalid characters -> `PERMISSION_DENIED` (`isValidId` rejection).
6. **String Resource Exhaustion**: Admin attempts `create` on `/coworkers/cw1` with a 5,000-char `name` -> `PERMISSION_DENIED` (`.size()` check).
7. **Unbounded Array & Unsafe Link Injection**: Admin attempts `create` on `/announcements/a1` with 50 items in `details` (> 20 limit) or `create` on `/worship_songs/s1` with a `javascript:` URI in `youtubeUrl` -> `PERMISSION_DENIED`.
8. **Fake Client Timestamp on Write**: Admin attempts `create` on `/announcements/t1` with a backdated `updatedAt` != `request.time` -> `PERMISSION_DENIED`.
9. **PII Leak via Visitor Request Read**: Non-admin authenticated user attempts `get` or `list` on `/visitor_requests` -> `PERMISSION_DENIED`.
10. **Visitor Request Status Tampering on Create**: Anonymous visitor attempts `create` on `/visitor_requests/req1` with `status: 'contacted'` -> `PERMISSION_DENIED`.
11. **Visitor Request CreatedAt Tampering**: Admin attempts `update` on `/visitor_requests/req1` changing immutable `createdAt` -> `PERMISSION_DENIED`.
12. **Self-Admin Privilege Escalation**: Non-admin user attempts `create` on `/admins/<their-uid>` -> `PERMISSION_DENIED`.
