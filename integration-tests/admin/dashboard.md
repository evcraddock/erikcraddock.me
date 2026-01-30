# Dashboard Integration Testing

Pass/fail tests for the admin dashboard.

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

## Dashboard Display (Pass/Fail)

### Dashboard Loads

1. Navigate to http://localhost:5000/admin
2. **PASS**: Page loads with "Admin Dashboard" heading
3. **FAIL**: Error page, redirect, or missing heading

### User Email Displayed

1. On dashboard page, look for logged-in user info
2. **PASS**: Shows "Logged in as <email>" with the admin email
3. **FAIL**: Email not displayed or incorrect

### Role Displayed

1. On dashboard page, look for role info
2. **PASS**: Shows "Role: Admin" for admin user
3. **FAIL**: Role not displayed or shows incorrect role

### Navigation Links Present

1. On dashboard page, check navigation
2. **PASS**: Links visible for Dashboard, Posts, API Keys, Passkeys, Authors
3. **FAIL**: Any navigation link missing

### Authors Link Only for Admins

1. Log in as a non-admin author (if one exists in test data)
2. Navigate to http://localhost:5000/admin
3. **PASS**: Authors link is NOT visible in navigation
4. **FAIL**: Authors link visible to non-admin

_Note: Skip this test if no non-admin author exists in test data_

---

## Navigation (Pass/Fail)

### Navigate to Posts

1. From dashboard, click "Posts" link
2. **PASS**: Navigates to /admin/posts
3. **FAIL**: Link broken or wrong destination

### Navigate to API Keys

1. From dashboard, click "API Keys" link
2. **PASS**: Navigates to /admin/keys
3. **FAIL**: Link broken or wrong destination

### Navigate to Passkeys

1. From dashboard, click "Passkeys" link
2. **PASS**: Navigates to /admin/passkeys
3. **FAIL**: Link broken or wrong destination

### Navigate to Authors (Admin Only)

1. From dashboard (as admin), click "Authors" link
2. **PASS**: Navigates to /admin/authors
3. **FAIL**: Link broken or wrong destination

---

## Logout Link (Pass/Fail)

### Logout Link Present

1. On dashboard page, look for logout link
2. **PASS**: Logout link visible
3. **FAIL**: Logout link missing

### Logout Works

1. Click logout link
2. **PASS**: Redirected to /login or home, session cleared
3. **FAIL**: Still logged in or error

---

## Notes

- Dashboard is the landing page after login
- All admin pages share the same navigation component
- Authors link visibility is role-dependent
