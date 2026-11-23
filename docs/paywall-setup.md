# Paywall setup checklist (server-enforced, Masar-shaped)

Policy (confirmed with owner on 2026-11-23): sign in with Google, first
**successful** generation free, then a **one-time 1 KWD** payment via WAMD
with the receipt sent to the owner's WhatsApp (+96560085043). After
activation, unlimited generation. Not recurring. Failed or timed-out
generations never consume the free attempt.

The gate ships dark: nothing changes for visitors until
`PAYWALL_ENABLED=true` (server) and `NEXT_PUBLIC_PAYWALL_ENABLED=true`
(client) are set and the project is redeployed.

## Provision once (needs owner approval before doing any of this)

1. Firebase console (https://console.firebase.google.com), signed in as
   ahmed.abdelbaset41290@gmail.com (verified console-accessible 2026-11-23;
   zero existing projects, Spark plan — a clean owner for this backend):
   - Create a NEW project (e.g. `resume-builder-access`). Keep it separate
     from Masar's `jobsautosearch` project; do not modify that project.
   - Enable **Authentication > Sign-in method > Google**.
   - Enable **Cloud Firestore** (Native mode). The no-cost Spark quota
     (firebase.google.com/docs/firestore/quotas: 1 GiB stored, 50k reads/day,
     20k writes/day, one free database per project) is far above this
     site's needs; no billing account is required.
   - Deploy `firestore.rules` from this repo (deny all client access;
     the server uses the Admin SDK).
   - Project settings > Service accounts > **Generate new private key**,
     then in Google Cloud IAM trim that service account to only
     **roles/datastore.user** (Firestore). ID-token verification needs no
     IAM role. Do not use the default broad editor key.
   - Note the owner's Firebase Auth uid (Authentication > Users after the
     owner signs in once on the site) for `OWNER_UID`.

2. Generate a random `ACTIVATION_CODE_SALT` (>= 32 chars). Keep it only in
   Vercel env vars; never commit it.

3. Vercel project env vars (both deployed projects):
   - `PAYWALL_ENABLED=true`
   - `NEXT_PUBLIC_PAYWALL_ENABLED=true`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON, single line)
   - `ACTIVATION_CODE_SALT`
   - `OWNER_UID`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
     `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
     (from the new project's web app config)

4. Add dependencies at merge time: `firebase` (client) and `firebase-admin`
   (server).

## Owner code issuance (no codes through chat)

After the owner signs in on the live site once, they issue codes from any
browser dev console or a small owner-only page:

```
fetch('/api/owner/codes', { method: 'POST',
  headers: { Authorization: 'Bearer ' + await firebase.auth().currentUser.getIdToken(),
             'Content-Type': 'application/json' },
  body: '{}' }).then(r => r.json())
```

The response shows the plaintext batch exactly once. The owner copies it
somewhere safe (e.g. their password manager) and sends individual codes to
payers by hand after receiving each WAMD receipt. Only salted hashes exist
server-side; codes are single-use and redemption is atomic.

## Go-live gates (do not skip)

- Live Gemini generation verified working reliably (not just once).
- End-to-end test on the deployed site: sign in, one free success, second
  attempt blocked with paywall, failed attempt not consumed, test code
  activates, unlimited after activation.
- Only then announce paid activation to users.

## Provisionally coded, needs owner decision before collection opens

- Whether switching the site language (the translation feature, type
  `translation` on the same route) consumes a generation attempt. The code
  currently authenticates translation requests but never counts them
  (`TRANSLATION_CONSUMES_ATTEMPT = false` in app/api/generate/route.js),
  matching the recommendation that translation transforms text the user
  already generated. Flip that constant only if the owner decides
  otherwise. Either way the decision must be explicit before collection
  opens.
