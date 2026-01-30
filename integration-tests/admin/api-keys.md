# API Keys Integration Testing

Pass/fail tests for API key management.

## Rules

- If any step fails or errors, mark the test as FAIL immediately and move on
- Do not troubleshoot, retry, or attempt fixes
- Do not refresh the page unless the test explicitly says to

## Prerequisites

- Dev server running (`make dev`)
- Browser open via browser-tools skill
- Logged in as admin (use web-login skill)

If any prerequisite fails, mark ALL tests in this file as FAIL and move on.

---

## Page Load (Pass/Fail)

### API Keys Page Loads

1. Navigate to http://localhost:5000/admin/keys
2. **PASS**: Page loads with "API Keys" heading and create form
3. **FAIL**: Error page, redirect, or missing elements

### Create Form Present

1. On API Keys page, look for create form
2. **PASS**: Form has name input and "Create Key" button
3. **FAIL**: Form missing or incomplete

---

## Create API Key (Pass/Fail)

### Create Key Successfully

1. Navigate to http://localhost:5000/admin/keys
2. Fill name field with "Test Key":
   ```javascript
   (function () {
     var input = document.querySelector("input[name=name]");
     var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
     setter.call(input, "Test Key");
     input.dispatchEvent(new Event("input", { bubbles: true }));
   })();
   ```
3. Click submit button:
   ```javascript
   document.querySelector("form button[type=submit]").click();
   ```
4. **PASS**: Success message appears with API key displayed, key is a long string
5. **FAIL**: Error message, no key displayed, or form error

### Key Shown Only Once Warning

1. After creating a key, check for warning message
2. **PASS**: Message warns "Copy this key now. You won't be able to see it again!"
3. **FAIL**: Warning not displayed

### Copy Button Works

1. After creating a key, check for copy button
2. **PASS**: Copy button present next to the key
3. **FAIL**: Copy button missing

### Empty Name Rejected

1. Navigate to http://localhost:5000/admin/keys
2. Leave name field empty
3. Click submit button
4. **PASS**: Error message "Name is required" or form validation prevents submit
5. **FAIL**: Key created without name

---

## List API Keys (Pass/Fail)

### Keys Listed

1. After creating a key, check the "Your API Keys" section
2. **PASS**: List shows "Test Key" with created date
3. **FAIL**: Key not in list

### Key Details Shown

1. Look at a key in the list
2. **PASS**: Shows key name, created date, and last used date (if used)
3. **FAIL**: Missing information

---

## Revoke API Key (Pass/Fail)

### Revoke Button Present

1. For an active key in the list, look for revoke option
2. **PASS**: "Revoke" button visible
3. **FAIL**: Revoke button missing

### Revoke Confirmation

1. Click revoke button on a key
2. **PASS**: Browser shows confirmation dialog
3. **FAIL**: No confirmation, immediate action

### Revoke Key Successfully

1. Click revoke and confirm
2. **PASS**: Page reloads, key shows "Revoked" badge
3. **FAIL**: Error or key still active

### Revoked Key No Revoke Button

1. Look at a revoked key in the list
2. **PASS**: No revoke button (already revoked)
3. **FAIL**: Revoke button still present

---

## Revoked Key Cannot Authenticate (Pass/Fail)

### Test Revoked Key

1. Copy the API key value before revoking (from creation step)
2. Revoke the key
3. Try to use the revoked key:
   ```bash
   curl -H "Authorization: Bearer <revoked-key>" http://localhost:5000/api/posts
   ```
4. **PASS**: Returns 401 Unauthorized
5. **FAIL**: Request succeeds or different error

---

## Notes

- API keys are per-author (each author manages their own)
- Keys are shown once at creation, then only the hash is stored
- Revoked keys cannot be un-revoked
- Use `make dev-tail` to check server logs for API errors
