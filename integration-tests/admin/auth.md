# Authentication Integration Testing

Pass/fail tests for magic link and session authentication.

## Rules

- If any step fails or errors, mark the test as FAIL immediately and move on
- Do not troubleshoot, retry, or attempt fixes
- Do not refresh the page unless the test explicitly says to

## Prerequisites

- Dev server running (`make dev`)
- Browser open via browser-tools skill
- `ADMIN_EMAIL` set in `.env`

If any prerequisite fails, mark ALL tests in this file as FAIL and move on.

## Skills

- **web-login**: Automated login via magic link (`.pi/skills/web-login/SKILL.md`)

---

## Magic Link Login (Pass/Fail)

### Request Magic Link

1. Navigate to http://localhost:5000/login in browser
2. Fill email field with admin email:
   ```javascript
   (function () {
     var input = document.querySelector("input[type=email]");
     var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
     setter.call(input, "ADMIN_EMAIL_HERE");
     input.dispatchEvent(new Event("input", { bubbles: true }));
   })();
   ```
3. Click submit button:
   ```javascript
   document.querySelector("button[type=submit]").click();
   ```
4. **PASS**: Page shows "Check your email" success message
5. **FAIL**: Error message, form validation error, or any other issue

### Magic Link Logged to Console

1. After requesting magic link, check server logs (`make dev-tail`)
2. Look for log line containing magic link URL:
   ```
   [HH:MM:SS] INFO  auth Magic link for your@email.com:
   [HH:MM:SS] INFO  auth http://localhost:5000/login/verify?token=...
   ```
3. **PASS**: Magic link URL visible in logs
4. **FAIL**: No magic link in logs

### Verify Magic Link

1. Copy magic link URL from server logs
2. Navigate to the magic link URL in browser
3. **PASS**: Redirected to /admin, session cookie set
4. **FAIL**: Error page, "link expired", "link invalid", or any other issue

### Invalid Email Handling (Security)

1. Navigate to http://localhost:5000/login
2. Fill email field with unauthorized email:
   ```javascript
   (function () {
     var input = document.querySelector("input[type=email]");
     var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
     setter.call(input, "notauthorized@example.com");
     input.dispatchEvent(new Event("input", { bubbles: true }));
   })();
   ```
3. Click submit button:
   ```javascript
   document.querySelector("button[type=submit]").click();
   ```
4. **PASS**: Same "Check your email" success message (no enumeration)
5. **FAIL**: Different message revealing email is invalid

### No Magic Link for Invalid Email

1. After submitting invalid email above, check server logs (`make dev-tail`)
2. Look for log lines:
   ```
   [HH:MM:SS] DEBUG auth Login attempt {"email":"notauthorized@example.com"}
   [HH:MM:SS] DEBUG auth Magic link requested for unauthorized email
   ```
3. **PASS**: No magic link URL in logs (only "unauthorized email" debug message)
4. **FAIL**: Magic link URL visible for unauthorized email

### Expired Magic Link

1. Request a magic link
2. Wait 16 minutes (or manually set expires_at to past in DB)
3. Navigate to magic link URL
4. **PASS**: Shows "link expired" error, redirects to /login?error=invalid
5. **FAIL**: Logs in successfully

### Already Used Magic Link

1. Request a magic link
2. Use the link to log in (should succeed)
3. Log out
4. Try the same magic link again
5. **PASS**: Shows "link already used" error, redirects to /login?error=invalid
6. **FAIL**: Logs in again

---

## Session Persistence (Pass/Fail)

### Session Survives Page Reload

1. Login via magic link
2. Navigate to http://localhost:5000/admin
3. Reload the page
4. **PASS**: Still on /admin, still logged in
5. **FAIL**: Redirected to /login

### Unauthenticated Access to Protected Route

1. Clear cookies / use incognito (or test with curl)
2. Navigate to http://localhost:5000/admin
3. **PASS**: Redirected to /login
4. **FAIL**: Shows admin page

---

## Logout (Pass/Fail)

### Logout Clears Session

1. Login via magic link
2. Click logout or navigate to /logout
3. Navigate to http://localhost:5000/admin
4. **PASS**: Redirected to /login
5. **FAIL**: Still shows admin page

---

## Notes

- Dev mode logs magic links to console instead of sending emails
- Port is 5000 in this project (not 3000)
- Use `make dev-tail` to view server logs
