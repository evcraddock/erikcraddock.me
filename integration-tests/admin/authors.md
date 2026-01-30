# Authors Integration Testing

Pass/fail tests for author management (admin-only feature).

## Rules

- If any step fails or errors, mark the test as FAIL immediately and move on
- Do not troubleshoot, retry, or attempt fixes
- Do not refresh the page unless the test explicitly says to

## Prerequisites

- Dev server running (`make dev`)
- Browser open via browser-tools skill
- Logged in as **admin** (use web-login skill with ADMIN_EMAIL)

If any prerequisite fails, mark ALL tests in this file as FAIL and move on.

## Important Note

This feature is **admin-only**. The admin is the first author added (defined by ADMIN_EMAIL in .env). Only admins can manage the author list.

---

## Access Control (Pass/Fail)

### Admin Can Access Authors Page

1. Log in as admin
2. Navigate to http://localhost:5000/admin/authors
3. **PASS**: Page loads with "Authors" heading
4. **FAIL**: Access denied, redirect, or error

### Non-Admin Cannot Access Authors Page

1. Log in as a non-admin author (if one exists)
2. Navigate to http://localhost:5000/admin/authors
3. **PASS**: Access denied or redirected (not the authors page)
4. **FAIL**: Authors page loads for non-admin

_Note: Skip if no non-admin author exists in test data_

### Unauthenticated Cannot Access

1. Clear session / use incognito
2. Navigate to http://localhost:5000/admin/authors
3. **PASS**: Redirected to /login
4. **FAIL**: Authors page accessible without auth

---

## Page Load (Pass/Fail)

### Authors Page Loads

1. As admin, navigate to http://localhost:5000/admin/authors
2. **PASS**: Page loads with "Authors" heading and add form
3. **FAIL**: Error page or missing elements

### Add Form Present

1. On Authors page, look for add form
2. **PASS**: Form has email input and "Add Author" button
3. **FAIL**: Form missing or incomplete

---

## Add Author (Pass/Fail)

### Add Author Successfully

1. Navigate to http://localhost:5000/admin/authors
2. Fill email field with a test email:
   ```javascript
   (function () {
     var input = document.querySelector("input[name=email]");
     var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
     setter.call(input, "newauthor@example.com");
     input.dispatchEvent(new Event("input", { bubbles: true }));
   })();
   ```
3. Click submit button:
   ```javascript
   document.querySelector("form button[type=submit]").click();
   ```
4. **PASS**: Success message "Added newauthor@example.com", author in list
5. **FAIL**: Error message or author not added

### Invalid Email Rejected

1. Try to add invalid email "not-an-email"
2. **PASS**: Error "Invalid email" or form validation prevents submit
3. **FAIL**: Invalid email accepted

### Duplicate Email Rejected

1. Try to add an email that already exists in authors
2. **PASS**: Error "author already exists" or similar
3. **FAIL**: Duplicate added or silent failure

### Empty Email Rejected

1. Leave email field empty
2. Click submit
3. **PASS**: Error "Email is required" or form validation prevents submit
4. **FAIL**: Form submits without email

---

## List Authors (Pass/Fail)

### Authors Listed

1. Check the "Allowed Authors" section
2. **PASS**: List shows all authors with email and added date
3. **FAIL**: Authors missing or list error

### Current User Badge

1. Find the current admin user in the list
2. **PASS**: Shows "You" badge next to your email
3. **FAIL**: Badge missing

### Author Details Shown

1. Look at an author in the list
2. **PASS**: Shows email and "Added: <date>"
3. **FAIL**: Missing information

---

## Remove Author (Pass/Fail)

### Remove Button Present for Others

1. For another author (not yourself), look for remove option
2. **PASS**: "Remove" button visible
3. **FAIL**: Remove button missing

### No Remove Button for Self

1. Find your own email in the list
2. **PASS**: No "Remove" button (cannot remove yourself)
3. **FAIL**: Remove button present for self

### Remove Confirmation

1. Click remove button on another author
2. **PASS**: Browser shows confirmation dialog
3. **FAIL**: No confirmation, immediate removal

### Remove Author Successfully

1. Click remove and confirm
2. **PASS**: Success message "Author removed", author no longer in list
3. **FAIL**: Error or author still in list

### Cannot Remove Self

1. Try to remove yourself via direct POST:
   ```bash
   # First get your author ID from the page source
   curl -X POST http://localhost:5000/admin/authors/<your-id>/delete \
     -H "Cookie: <session-cookie>"
   ```
2. **PASS**: Error "Could not remove author" (self-removal blocked)
3. **FAIL**: Successfully removes self

---

## Removed Author Access (Pass/Fail)

### Removed Author Cannot Login

1. Add a test author
2. Remove the test author
3. Try to request magic link for removed author's email
4. **PASS**: Same "Check your email" message (no enumeration), but no magic link sent
5. **FAIL**: Magic link sent to removed author

### Removed Author Session Invalidated

1. Add a test author
2. Log in as that author in a separate browser/session
3. Remove the author from admin panel
4. Have the removed author try to access /admin
5. **PASS**: Redirected to /login (session invalid)
6. **FAIL**: Still has access

_Note: This test requires two browser sessions_

---

## Notes

- Only the admin (ADMIN_EMAIL) can manage authors
- Authors can be regular authors or admins (first author is admin)
- Cannot remove yourself to prevent lockout
- Removing an author revokes their access immediately
- Email validation happens server-side
- Same "Check your email" message for all login attempts (security - no email enumeration)
