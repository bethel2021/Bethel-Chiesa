# Security Summary

**Reviewed Files**: 33
**Issues Resolved**: 7

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Admin Role Escalation & Self-Lockout | `firestore.rules`, `src/context/ChurchDataContext.tsx`, `src/components/admin/AdminVisitorsPanel.tsx` | 395, 1615, 229 | Any delegated coworker in `/admins` could list coworker emails/UIDs, create arbitrary new admin accounts, or delete other admins (or themselves); admin email syntax was not validated and the main admin email was rendered in the RBAC panel. | High | Fixed | Restricted `/admins` list, create, and delete operations in `firestore.rules` strictly to `isBootstrappedAdmin()` with `adminUid != request.auth.uid` and email regex validation; added `isMainAdmin` gating in UI/listeners, masked the main admin email in `AdminVisitorsPanel.tsx`, and added self-deletion/email checks in `ChurchDataContext.tsx`. |
| Delayed UI Revocation for Delegated Admins | `src/context/ChurchDataContext.tsx` | 716 | Non-bootstrapped admins were checked once via `getDoc` at sign-in, so revoking an `/admins/{uid}` document left the coworker's browser in the admin workspace UI until a page reload. | Medium | Fixed | Replaced the one-time lookup with a real-time `onSnapshot(doc(db, 'admins', currentUser.uid))` listener gated by `emailVerified` and epoch cleanup, immediately stripping `isAdmin` state and clearing `visitorRequests` on revocation. |
| Unvalidated Links & Cache Hydration | `src/components/admin/AdminWorshipEditor.tsx`, `src/context/ChurchDataContext.tsx`, `src/utils/urlSafety.ts` | 108, 217, 1012 | `AdminWorshipEditor.tsx` rendered song `<a href>` links without checking the HTTPS YouTube allowlist, `normalizeWorshipSongs` retained unvalidated URLs from `localStorage` cache, and `syncModifiedContentToCloud` did not filter song URLs. | Medium | Fixed | Created shared validators in `src/utils/urlSafety.ts`, enforced `isSafeYoutubeUrl` directly on `AdminWorshipEditor.tsx` link rendering, and sanitized image/YouTube URLs in `normalizeChurchInfo`, `normalizePastors`, `normalizeCoworkers`, `normalizeWorshipSongs`, and `syncModifiedContentToCloud`. |
| Overbroad Collection List & Chunk Bounds | `firestore.rules` | 101, 296, 303 | `church_sections` allowed unauthenticated `list` queries even though clients only fetch known document IDs (`info`, `public_bundle`), `isValidMediaChunk` did not verify `chunkIndex < totalChunks`, and `siteTheme` omitted an explicit string type check. | Low | Fixed | Disabled `allow list: if false;` on `church_sections`, added `data.chunkIndex < data.totalChunks` to `isValidMediaChunk`, and added `data.siteTheme is string` to `isValidChurchInfo`. |
| Protocol-Relative Image URL Bypass | `firestore.rules`, `vite.config.ts`, `src/components/SafeImage.tsx`, `src/lib/mediaStorage.ts` | 59, 51, 21, 172 | Image URL checks matched `^/`, allowing protocol-relative external URLs (`//example.com/...`) to pass validation and trigger preloads as root-relative paths. | Low | Fixed | Tightened regexes to require either explicit `http(s)://` or a single leading `/` (`^/(?!/)` in JS, `^/[^/]` in Firestore RE2 and head prefetch). |
| PII & Internal Metadata in Error Logs/UI | `src/lib/firebase.ts`, `src/components/admin/AdminSharedUI.tsx`, `AdminDashboard.tsx`, `AdminInfoEditor.tsx`, `AdminPastorsEditor.tsx`, `AdminThemeEditor.tsx` | 143, 80, 216 | `handleFirestoreError` included `userId`, `email`, and `providerInfo` in thrown/logged JSON errors, and admin forms and Gate 1 sign-in displayed raw `err.message` strings in UI banners. | Low | Fixed | Removed email/UID/provider details from `handleFirestoreError` (`firebase.ts`), added `getFriendlyAdminError` in `AdminSharedUI.tsx`, and mapped all Gate 1 Firebase Auth error codes in `AdminDashboard.tsx` to safe Chinese messages. |
| Unhandled Rejections on Delete Actions | `AdminWorshipEditor.tsx`, `AdminMinistryEditor.tsx`, `AdminAnnouncementsEditor.tsx`, `AdminVisitorsPanel.tsx` | 160, 164, 113, 296 | Inline delete and permission revocation buttons awaited Firestore mutations without `try/catch` error handling. | Low | Fixed | Wrapped all async delete and permission-revocation click handlers in `try/catch` blocks reporting errors through `StatusBanner`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Google OAuth Login & Real-Time RBAC | `src/lib/firebase.ts`, `src/context/ChurchDataContext.tsx`, `src/components/admin/AdminDashboard.tsx` | Uses Firebase Authentication Google OAuth (`prompt: 'select_account'`) with single-flight popup locking, requires `emailVerified == true` on both client and Firestore rules, monitors delegated `/admins/{uid}` status in real time via `onSnapshot`, and clears all admin/visitor state immediately on revocation or sign-out. |
| Firestore RBAC & PII Isolation | `firestore.rules` | Root default-deny catch-all; `visitor_requests` reads, status updates, and deletes require verified admin status; public visitor submissions enforce `status == 'pending'`, strict field allowlists, length limits, and `request.time`. |
| Output & Link Safety | `src/components/WorshipSection.tsx`, `src/components/ContactSection.tsx`, `src/components/SafeImage.tsx` | All UI text renders through React escaping (zero `dangerouslySetInnerHTML`, `eval`, or `window.open`); external links use `rel="noopener noreferrer"` and HTTPS origin allowlists; images reject SVG data URIs. |
| Lossless Image Upload Safety | `src/components/admin/ImageFieldControl.tsx`, `src/lib/mediaStorage.ts` | Client file uploads enforce strict MIME allowlists (`image/jpeg`, `image/png`, `image/webp`) and a 12 MB cap; `media_chunks` allow direct get by known ID only, disable `list`, enforce `chunkIndex < totalChunks`, and require verified admin writes. |
| HTTP Security Headers & Dependencies | `public/_headers`, `package.json` | Configures HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and restrictive `Permissions-Policy`. `bun audit` advisories (`@grpc/grpc-js`, `minimatch`) apply only to Node/dev-only tooling and are excluded from browser `dist/`. |

## PoC Verification

### Delegated Admin Privilege Escalation & Tampered Cache Link Rendering

#### Summary
| Field | Value |
|---|---|
| Issue Type | Lateral Role Escalation in `/admins` & Unfiltered Admin Link / Cache URLs |
| Impact | High |
| Affected File | `firestore.rules:392-399`, `src/context/ChurchDataContext.tsx:213-256,883-906,1554-1582`, `src/components/admin/AdminWorshipEditor.tsx:108-140`, `src/components/admin/AdminVisitorsPanel.tsx:219-325` |
| Test Scenario | 1) A compromised secondary admin in `/admins/{uid}` attempts to create a backdoor document in `/admins/{attackerUid}` or delete another coworker's `/admins` entry; 2) A tampered `localStorage` entry injects `javascript:alert(1)` into `worshipSongs[].youtubeUrl` or `//evil.example/img.png` into `churchInfo.heroImage`. |

#### How It Was Fixed
Updated `firestore.rules` so only `isBootstrappedAdmin()` can `list`, `create`, or `delete` in `/admins/{adminUid}` (with `adminUid != request.auth.uid` and strict email format validation), aligned `ChurchDataContext.tsx` and `AdminVisitorsPanel.tsx` with `isMainAdmin` gating, and enforced `isSafeYoutubeUrl` and `SAFE_HTTP_OR_ROOT_RELATIVE_REGEX` (`^/(?!/)`) during both cache hydration and JSX rendering.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Secondary admin calls `setDoc(doc(db, 'admins', 'attacker'), ...)` | Rejected by Firestore rule `isBootstrappedAdmin()` at `firestore.rules:398` |
| 2 | Tampered `youtubeUrl: "javascript:alert(1)"` enters `localStorage` | Stripped to `""` by `filterSafeYoutubeUrl` in `normalizeWorshipSongs` (`ChurchDataContext.tsx:239`) and filtered again before `<a href>` at `AdminWorshipEditor.tsx:108` |
| 3 | Tampered `heroImage: "//evil.example/a.png"` enters cache or form | Rejected by `SAFE_HTTP_OR_ROOT_RELATIVE_REGEX` in `normalizeChurchInfo`, `SafeImage.tsx:21`, `vite.config.ts:51`, and `firestore.rules:59` |

#### Conclusion
**Fix Verified** - Admin role assignment and revocation are locked exclusively to the verified bootstrapped main administrator, and neither tampered cache values nor protocol-relative/script URLs can pass client validation or Firestore rules.
