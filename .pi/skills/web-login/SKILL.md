---
name: web-login
description: Login to the local web app using magic link authentication. Use when needing to authenticate with the web app at localhost:5000.
---

# Web Login

Login to erikcraddock.me using magic link authentication.

## Prerequisites

- Dev server running (`make dev`)
- Browser open via browser-tools skill
- Admin email seeded: `ADMIN_EMAIL=your@email.com bun scripts/seed.ts`

## Steps

### 1. Navigate to Login

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/login
```

### 2. Get Admin Email

Check .env or use default test email:

```bash
ADMIN_EMAIL=$(grep ADMIN_EMAIL .env 2>/dev/null | cut -d= -f2 || echo "test@example.com")
echo $ADMIN_EMAIL
```

### 3. Fill Email

Replace `ADMIN_EMAIL_HERE` with actual email:

```bash
~/.local/share/pi-skills/browser-tools/browser-eval.js '(function() {
  var input = document.querySelector("input[type=email]");
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "ADMIN_EMAIL_HERE");
  input.dispatchEvent(new Event("input", { bubbles: true }));
})()'
```

### 4. Submit Form

```bash
~/.local/share/pi-skills/browser-tools/browser-eval.js 'document.querySelector("button[type=submit]").click()'
```

### 5. Verify Success Message

Take screenshot - should show "Check your email" success message.

### 6. Get Magic Link from Logs

```bash
cd /home/erik/Private/code/github/evcraddock/erikcraddock.me && \
TMUX_SOCK=$(ls -t /tmp/tmux-$(id -u)/overmind-erikcraddock-me-* 2>/dev/null | head -1) && \
tmux -L "$(basename $TMUX_SOCK)" capture-pane -t erikcraddock-me:app -p -S -50 | grep -oP 'http://localhost:5000/login/verify\?token=[a-f0-9]+'
```

### 7. Navigate to Magic Link

> **BLOCKED**: Requires /login/verify route (Task #1305)

```bash
~/.local/share/pi-skills/browser-tools/browser-nav.js "MAGIC_LINK_URL_HERE"
```

### 8. Verify Login

Take screenshot - should see Admin Dashboard or protected page.

## Quick Login (All Steps)

```bash
# 1. Open login page
~/.local/share/pi-skills/browser-tools/browser-nav.js http://localhost:5000/login

# 2. Fill and submit (replace email)
~/.local/share/pi-skills/browser-tools/browser-eval.js '(function() {
  var input = document.querySelector("input[type=email]");
  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, "test@example.com");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  setTimeout(function() { document.querySelector("button[type=submit]").click(); }, 100);
})()'

# 3. Get magic link from logs
MAGIC_LINK=$(cd /home/erik/Private/code/github/evcraddock/erikcraddock.me && \
  TMUX_SOCK=$(ls -t /tmp/tmux-$(id -u)/overmind-erikcraddock-me-* 2>/dev/null | head -1) && \
  tmux -L "$(basename $TMUX_SOCK)" capture-pane -t erikcraddock-me:app -p -S -50 | \
  grep -oP 'http://localhost:5000/login/verify\?token=[a-f0-9]+' | tail -1)
echo "Magic link: $MAGIC_LINK"

# 4. Navigate to magic link (when /login/verify is implemented)
# ~/.local/share/pi-skills/browser-tools/browser-nav.js "$MAGIC_LINK"
```
