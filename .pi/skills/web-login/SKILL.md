---
name: web-login
description: Complete login via magic link on the current page. Use when a login form is already open in the browser.
---

# Web Login

Complete magic link authentication on the current page. Works on `/login`, `/cli/auth`, or any page with the email login form.

## Prerequisites

- Dev server running (`make dev`)
- Browser already open to a page with login form
- `ADMIN_EMAIL` set in `.env`

## Steps

### 1. Get Admin Email

```bash
ADMIN_EMAIL=$(grep ADMIN_EMAIL .env | cut -d= -f2)
```

### 2. Fill Email and Submit

```bash
~/.local/share/pi-skills/browser-tools/browser-eval.js "(function() {
  var input = document.querySelector('input[type=email]');
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '$ADMIN_EMAIL');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(function() { document.querySelector('button[type=submit]').click(); }, 100);
})()"
```

### 3. Get Magic Link from Logs

The magic link is split across two lines in the logs. Join lines and extract the full URL including redirect param:

```bash
sleep 2
MAGIC_LINK=$(make dev-tail 2>&1 | tr -d '\n' | grep -oP 'http://localhost:5000/login/verify\?token=[a-f0-9]+(&redirect=[A-Za-z0-9%]+)?' | tail -1)
echo "Magic link: $MAGIC_LINK"
```

**Important:** The URL includes `&redirect=...` which tells the verify endpoint where to redirect after login. Don't strip this!

### 4. Navigate to Magic Link

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js "$MAGIC_LINK"
```

Browser will redirect back to the original page (e.g., `/cli/auth`) after login completes.

## Troubleshooting

### No magic link in logs

- Check `make dev-tail` manually
- Ensure ADMIN_EMAIL in .env matches what the form expects

### Magic link truncated / redirect lost

The log output wraps long URLs across lines. Use `tr -d '\n'` to join lines before grepping. Make sure the regex captures the `&redirect=` param.

### Login redirects to wrong page

Check that the magic link includes the `&redirect=` parameter. If missing, the original page didn't pass the redirect correctly.
