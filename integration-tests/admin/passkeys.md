# Passkeys Integration Testing

Pass/fail tests for passkey management.

## Rules

- If any step fails or errors, mark the test as FAIL immediately and move on
- Do not troubleshoot, retry, or attempt fixes
- Do not refresh the page unless the test explicitly says to

## Prerequisites

- Dev server running (`make dev`)
- Browser open via browser-tools skill
- Logged in as admin (use web-login skill)

If any prerequisite fails, mark ALL tests in this file as FAIL and move on.

## Important Note

Passkey registration requires WebAuthn which needs:

- A secure context (HTTPS or localhost)
- User interaction (cannot be fully automated)
- A hardware authenticator or platform authenticator

Some tests may require manual interaction or may need to be skipped in fully automated environments.

---

## Page Load (Pass/Fail)

### Passkeys Page Loads

1. Navigate to http://localhost:5000/admin/passkeys
2. **PASS**: Page loads with "Passkeys" heading
3. **FAIL**: Error page, redirect, or missing heading

### Registration Section Present

1. On Passkeys page, look for registration section
2. **PASS**: "Register New Passkey" section with explanation and button
3. **FAIL**: Registration section missing

### Register Button Present

1. Look for register button
2. **PASS**: "Register Passkey" button visible
3. **FAIL**: Button missing

---

## Passkey Registration Flow (Pass/Fail)

### Registration Prompts for Name

1. Click "Register Passkey" button
2. **PASS**: Browser prompt asks for passkey name
3. **FAIL**: No prompt, immediate error

### Cancel Registration

1. Click "Register Passkey" button
2. Cancel the name prompt (click Cancel or press Escape)
3. **PASS**: No error, stays on page
4. **FAIL**: Error message or unexpected behavior

### Registration Options Fetched

1. Click "Register Passkey" button
2. Enter a name when prompted
3. Check browser console/network for POST to /admin/passkeys/register/options
4. **PASS**: Request returns 200 with WebAuthn options
5. **FAIL**: Request fails or returns error

_Note: Full registration requires WebAuthn interaction which may need manual testing_

---

## List Passkeys (Pass/Fail)

### Empty State

1. If no passkeys registered, check the list section
2. **PASS**: Shows "No passkeys registered yet" message
3. **FAIL**: Empty list with no message or error

### Passkeys Listed

1. After registering a passkey (manual or prior), check list
2. **PASS**: List shows passkey with name and created date
3. **FAIL**: Passkey not in list

### Passkey Details Shown

1. Look at a passkey in the list
2. **PASS**: Shows name, created date, last used date (if used)
3. **FAIL**: Missing information

---

## Delete Passkey (Pass/Fail)

### Delete Button Present

1. For a passkey in the list, look for delete option
2. **PASS**: "Delete" button visible
3. **FAIL**: Delete button missing

### Delete Confirmation

1. Click delete button on a passkey
2. **PASS**: Browser shows confirmation dialog
3. **FAIL**: No confirmation, immediate deletion

### Delete Passkey Successfully

1. Click delete and confirm
2. **PASS**: Page shows success message, passkey removed from list
3. **FAIL**: Error or passkey still in list

---

## Passkey Login (Pass/Fail)

_These tests require a registered passkey_

### Login Page Shows Passkey Option

1. Log out
2. Navigate to http://localhost:5000/login
3. **PASS**: Page shows option to login with passkey (if passkeys exist)
4. **FAIL**: No passkey login option

### Passkey Login Flow

1. Click passkey login option
2. Complete WebAuthn authentication (manual interaction required)
3. **PASS**: Logged in, redirected to /admin
4. **FAIL**: Authentication fails or error

_Note: This test requires manual interaction with the authenticator_

---

## Error Handling (Pass/Fail)

### Invalid Passkey ID

1. Try to delete a non-existent passkey:
   ```bash
   curl -X POST http://localhost:5000/admin/passkeys/99999/delete \
     -H "Cookie: <session-cookie>"
   ```
2. **PASS**: Error message "Invalid passkey ID" or "Could not delete"
3. **FAIL**: Server error or unexpected behavior

### Unauthorized Access

1. Without session, try to access passkeys page:
   ```bash
   curl http://localhost:5000/admin/passkeys
   ```
2. **PASS**: Redirected to /login
3. **FAIL**: Page accessible without auth

---

## Notes

- Passkeys use WebAuthn which requires user interaction
- localhost is a secure context for WebAuthn testing
- Full registration flow may need manual testing
- Each user manages their own passkeys
- Deleting all passkeys still allows magic link login
