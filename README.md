# EHS Hall Capture

A phone camera app for hallway checks. Built on the existing Hall Capture app and its device-local records.

## Use on a phone

1. Open the hosted HTTPS app in Safari on iPhone or Chrome on Android. Sign in with an approved school Google account. The shared roster is already available; no CSV download is needed. Verify the bell schedule and locations in Setup.
2. Tap **Start camera**, allow camera access, and hold the full barcode in view. The app selects a rear camera initially. Camera selection and flashlight controls appear when supported.
3. Choose **Nurse**, **Bathroom**, **Other class**, **Office**, or **No pass**, then save the hallway log. Manual entry is also available.
4. **No pass** creates a local referral draft. Check the matched student name and grade, review the description, and open the linked Cognito form to finish and submit. Choose the appropriate infraction and complete any remaining required fields there. The app never assumes an infraction category or disciplinary consequence.
5. Export scans and sweeps separately. All no-pass drafts, including earlier dates, are available under **Today**.

Add the app to the home screen with Safari's Share menu or Chrome's menu. An internet connection is required for staff sign-in, student lookup, and Cognito. Scanner assets can be cached, but private roster responses are never cached.

## Data and referral behavior

- The student roster is stored in private server-side D1 storage. Every lookup requires a valid staff session and exact allowlisted email. School domain membership alone does not grant access. Hallway records and drafts remain in this browser on this phone; these existing logs are not synchronized.
- Roster CSV columns are `Student Id`, `First Name`, `Last Name`, and optional `Grade`. The school's supplied header layout is supported. Student email columns are ignored. Only the configured administrator can upload a replacement shared roster in Setup. It is stored privately on the server, never bundled with the public app or committed to GitHub. The prior whole-roster device cache is removed on upgrade.
- On a match, the pass check shows the student's name and grade; those values are saved with the log and prefilled in the no-pass referral. Unknown IDs remain loggable without a guessed identity. Duplicate IDs and missing required data reject the whole import and preserve the prior roster. Replacing a roster does not rewrite historical log names.
- Existing `hc.*` storage keys are preserved. A different hosting origin has separate storage; export records from the old address before switching.
- Scanned IDs remain strings, preserving leading zeros. Print-barcode formats supported by ZXing's 1D reader include Code 128 and Code 39. Camera frames are processed on the phone and are not uploaded.
- Repeated IDs are blocked for 20 seconds, including nonconsecutive repeats. A scan is logged only after a pass type is selected and the user saves it.
- Cognito's public-link prefilling uses its documented `entry` JSON parameter. Fields were verified against the public schema for form 445 on September 9, 2026. Names, grade, email, date, recognized period, location, and the incident description are prefilled. IDs are included in the description because this form has no Student ID field.
- Cognito prefilling puts those values into the destination URL. The app marks the record `opened` when the form is launched, never `submitted`; it cannot verify completion on another website. Check Cognito before submitting an already-opened draft again.
- Browser-data clearing removes logs. Export regularly. A visible warning appears if browser storage fails.

## Build and host

This app requires a Cloudflare-compatible Worker and D1 database; it cannot run as a static GitHub Pages site. Install the pinned dependencies, generate schema migrations with Drizzle when changing the schema, and run `node build.cjs`. Sites applies the schema-only migrations from `dist/.openai/drizzle` and provides the logical `DB` binding. On Windows hosts that block Node subprocesses, run `node build.cjs --prepare-only`, then invoke the installed esbuild executable directly with `server/worker.mjs --bundle --format=esm --platform=browser --target=es2022 --outfile=dist/server/index.js`.

Configure server environment variables: `GOOGLE_CLIENT_ID`, `APP_ORIGIN` (exact HTTPS app origin), `APPROVED_STAFF_EMAILS` (comma separated exact addresses), and `ADMIN_EMAIL`. Do not put private configuration or student records in source control. Google Identity Services uses a Web Application client with the app origin registered; no client secret is used. Signed Google ID tokens are verified for signature, issuer, audience, expiry, hosted domain, verified email, and one-time nonce. The server issues a 12-hour HttpOnly/Secure/SameSite session and rechecks the allowlist on every protected request. Sessions can be revoked by removing an email and applying the environment update. Same-origin requests and one-time login challenges prevent login CSRF and replay.

An optional initial private import accepts a high-entropy bearer token whose SHA-256 hash is stored in `ROSTER_BOOTSTRAP_HASH`, with a short epoch-seconds deadline in `ROSTER_BOOTSTRAP_EXPIRES`. A database marker atomically prevents repeat initialization. Remove both bootstrap environment variables after initial import. Normal roster updates use the authenticated administrator import. The bootstrap token and roster must never appear in Git, assets, or logs.

The scanner is bundled locally at `vendor/zxing-browser.min.js` (ZXing Browser 0.1.5), with third-party licenses alongside it. Do not replace it with an unpinned CDN reference: offline camera scanning depends on the local asset.

Google verification follows [Google’s server verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Validation

Automated checks cover all five pass types, cancel-before-save, duplicates, ID validation and leading zeros, existing-record preservation, CSV export, Cognito payload mapping, numeric/alphanumeric Code 128 and Code 39 decoding, cancelled camera startup, and denied camera permission. Tests use synthetic records only and never submit a Cognito referral.

Live camera focus, barcode readability, and home-screen behavior must still be checked on the school's actual IDs and physical iPhone/Android devices before hallway use. Lighting, device lenses, barcode size, and print quality affect recognition.

Reference: [Cognito Forms prefilling documentation](https://www.cognitoforms.com/support/65/data-integration/prefilling-a-form).
