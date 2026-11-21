# Security Summary

**Reviewed Files**: 19
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Unused Build Key Injection | `vite.config.ts` | 17 | `GOOGLE_MAPS_API_KEY` environment lookup was injected via `define` into the public client bundle even after switching to key-free Google Maps navigation URLs. | Medium | Fixed | Removed unused key lookup and `define` injection so no unnecessary key is bundled into `dist/`. |
| External Link Scheme Guard | `src/components/WorshipSection.tsx` | 192 | Worship song `<a href>` links checked non-empty strings without re-verifying the HTTPS YouTube origin on render (e.g. if local cache was tampered). | Medium | Fixed | Added a strict HTTPS YouTube domain regex filter directly before rendering song `<a href>` elements. |
| Image Source Allowlist | `src/components/SafeImage.tsx` | 11 | `SafeImage` passed `src` directly to `<img src>` without validating against `javascript:` or non-raster SVG data URIs if loaded from local storage. | Low | Fixed | Added `isSafeImageSrc` validating `http(s)://`, root-relative `/`, and raster JPEG/PNG/WebP base64 URIs with safe UI fallback. |
| Admin Email Exposure on Unprivileged Gate | `src/components/admin/AdminDashboard.tsx` | 242 | Any signed-in non-admin Google user visiting `/admin` was shown the main administrator's personal Gmail address. | Low | Fixed | Replaced the personal email with a generic administrator contact prompt on the unauthorized gate. |
| Unhandled Rejection on PII Admin Actions | `src/components/admin/AdminVisitorsPanel.tsx` | 154 | Inline visitor request status/note update and deletion handlers lacked `try/catch` error handling. | Low | Fixed | Wrapped async mutations in `try/catch` and surfaced errors via `StatusBanner`. |
| Production HTTP Security Headers | `public/_headers` | 1 | Cloudflare Pages headers lacked `Strict-Transport-Security`, `Permissions-Policy`, and `X-XSS-Protection`. | Low | Fixed | Added HSTS, restrictive `Permissions-Policy` (`camera=(), microphone=(), geolocation=(), payment=()`), and `X-XSS-Protection: 0`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Firestore RBAC & PII Isolation | `firestore.rules` | Default-deny catch-all at root; `visitor_requests` reads/updates/deletes are strictly limited to verified admins; public creates enforce `status == 'pending'`, strict field allowlists, and `request.time`. |
| Authentication & Role Checks | `src/context/ChurchDataContext.tsx` | Admin mode requires `email_verified` and either the bootstrapped admin identity or existence in `/admins/{uid}`, enforced server-side by Firestore security rules. |
| Output & Link Safety | `src/components/WorshipSection.tsx` | All JSX text uses React escaping (zero `dangerouslySetInnerHTML`), external links use `rel="noopener noreferrer"`, and YouTube links enforce HTTPS YouTube domains. |
| Client Cache & Image Compression | `src/components/admin/ImageFieldControl.tsx` | Local image uploads are re-encoded in-browser via HTML5 Canvas strictly as JPEG/WebP within size limits, blocking SVG script payloads. |
| Dependency Audit (`bun audit`) | `package.json` | `@grpc/grpc-js` (inside Firebase Node-only transport) and `minimatch` (inside dev-only ESLint plugins) are never bundled into the Cloudflare Pages static browser `dist/` output. |

## PoC Verification

### Unused API Key Build Injection & Untrusted URL Scheme Filtering

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unused Client-Bundle Key Injection & Unvalidated Render URLs |
| Impact | Medium |
| Affected File | `vite.config.ts`, `src/components/WorshipSection.tsx:192`, `src/components/SafeImage.tsx:11` |
| Test Scenario | 1) Running `vite build` with `GOOGLE_MAPS_API_KEY` set in environment; 2) Tampered `localStorage` entry setting `youtubeUrl` or `image` to `javascript:alert(1)` or `data:image/svg+xml,...`. |

#### How It Was Fixed
Removed the `__GOOGLE_MAPS_API_KEY__` build-time `define` from `vite.config.ts`, enforced an HTTPS YouTube domain regex filter in `WorshipSection.tsx`, and added `isSafeImageSrc` allowlist validation in `SafeImage.tsx`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `vite build` reads `vite.config.ts` with `GOOGLE_MAPS_API_KEY` present in `process.env` | No `define` entry injects any key into `dist/assets/*.js` |
| 2 | Tampered `javascript:alert(1)` enters `worshipSongs` state | Filtered out at `WorshipSection.tsx:192–197` before rendering `<a href>` |
| 3 | Tampered `data:image/svg+xml,...` enters `SafeImage` | Rejected by `isSafeImageSrc` at `SafeImage.tsx:11–18`; neutral church icon fallback renders instead |

#### Conclusion
**Fix Verified** - Neither build-environment Maps keys nor tampered script/SVG URLs can enter the rendered production DOM or static bundle.
