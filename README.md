# EHS Hall Capture

A phone camera app for hallway checks. Built on the existing Hall Capture app and its device-local records.

## Use on a phone

1. Open the hosted HTTPS app in Safari on iPhone or Chrome on Android. In Setup, verify the bell schedule and locations and save your staff email.
2. Tap **Start camera**, allow camera access, and hold the full barcode in view. The app selects a rear camera initially. Camera selection and flashlight controls appear when supported.
3. Choose **Nurse**, **Bathroom**, **Other class**, **Office**, or **No pass**, then save the hallway log. Manual entry is also available.
4. **No pass** creates a local referral draft. Add a student name and grade, review the description, and open the linked Cognito form to finish and submit. Choose the appropriate infraction and complete any remaining required fields there. The app never assumes an infraction category or disciplinary consequence.
5. Export scans and sweeps separately. All no-pass drafts, including earlier dates, are available under **Today**.

Add the app to the home screen with Safari's Share menu or Chrome's menu. Load it online once so its scanner can be cached. Hallway logging then works offline; Cognito requires connectivity.

## Data and referral behavior

- Records, drafts, staff email, locations, and schedule are stored only in this browser on this phone. There is no cross-device synchronization or roster lookup.
- Existing `hc.*` storage keys are preserved. A different hosting origin has separate storage; export records from the old address before switching.
- Scanned IDs remain strings, preserving leading zeros. Print-barcode formats supported by ZXing's 1D reader include Code 128 and Code 39. Camera frames are processed on the phone and are not uploaded.
- Repeated IDs are blocked for 20 seconds, including nonconsecutive repeats. A scan is logged only after a pass type is selected and the user saves it.
- Cognito's public-link prefilling uses its documented `entry` JSON parameter. Fields were verified against the public schema for form 445 on September 9, 2026. Names, grade, email, date, recognized period, location, and the incident description are prefilled. IDs are included in the description because this form has no Student ID field.
- Cognito prefilling puts those values into the destination URL. The app marks the record `opened` when the form is launched, never `submitted`; it cannot verify completion on another website. Check Cognito before submitting an already-opened draft again.
- Browser-data clearing removes logs. Export regularly. A visible warning appears if browser storage fails.

## Build and host

The app is static and has no runtime installation step. Serve the repository files over HTTPS or run `node build.cjs` for a `dist/` copy. `.openai/hosting.json` identifies the private Sites deployment. GitHub Pages can also serve the repository root after an authorized release. Do not publish exported student records in the source repository.

The scanner is bundled locally at `vendor/zxing-browser.min.js` (ZXing Browser 0.1.5), with third-party licenses alongside it. Do not replace it with an unpinned CDN reference: offline camera scanning depends on the local asset.

## Validation

Automated checks cover all five pass types, cancel-before-save, duplicates, ID validation and leading zeros, existing-record preservation, CSV export, Cognito payload mapping, numeric/alphanumeric Code 128 and Code 39 decoding, cancelled camera startup, and denied camera permission. Tests use synthetic records only and never submit a Cognito referral.

Live camera focus, barcode readability, and home-screen behavior must still be checked on the school's actual IDs and physical iPhone/Android devices before hallway use. Lighting, device lenses, barcode size, and print quality affect recognition.

Reference: [Cognito Forms prefilling documentation](https://www.cognitoforms.com/support/65/data-integration/prefilling-a-form).
