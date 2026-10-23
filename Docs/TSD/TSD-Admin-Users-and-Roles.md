# Technical Specification — Administration: Users and Roles

| | |
| --- | --- |
| Document ID | PID-TSD-002 |
| Version | 1.1 |
| Date | 20 October 2026 |
| Status | Implementation baseline for the Administration menu |
| Audience | Engineering |
| Functional source | `Docs/FSD/FSD-User-Management.md` (PID-FSD-002, version 1.1) for User Management, the sign-in page, the closed dashboard, and the account menu. Role Management has no separate functional spec. Its rules come from `Docs/FSD/FSD-Plant-Information-Dashboard.md` section 5 and from `Docs/TSD/TECH-SPEC-Plant-Information-Dashboard.md` section 8.6. Screen patterns follow PID-FSD-002. |
| Parent implementation | `Docs/TSD/TECH-SPEC-Plant-Information-Dashboard.md` |
| Pattern | Jetty Planning System sign-in (`Login.jsx`), Admin → Users, and Admin → Roles. Sites replace ports. This product does not share that database or those routes. |

Single sign-on, departments, and partner-API administration are out of this release.

The screens use `tokens.css`, `shell.css`, and `master.css`. Labels live in `Frontend/src/i18n/messages.ts`.

This module is parent technical spec Phase 5. It is built before Testing is opened past the office network.

---

## 1. What this module adds

An Administration entry in the sidebar, two screens, the sign-in page, and the account menu.

| Screen | Route | Who sees it |
| --- | --- | --- |
| Sign-in | `/login` | A visitor with no session. No sidebar and no top bar |
| Administration | `/admin` | Signed in, and view on `admin-users` or `admin-roles` |
| User Management | `/admin/users` | Signed in, page key `admin-users` |
| Role Management | `/admin/roles` | Signed in, page key `admin-roles` |
| Change password | Dialog from the top bar | Any signed-in active user |

There is no self-registration. An account exists only after an administrator creates it. Operators and mechanics do not receive accounts. They keep using LogSheet Builder.

---

## 2. Schema

Migration `001` already names `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, and `user_sites`. This module corrects where the flags live and adds the columns the functional spec needs. Do this in the next migration, before the screens ship.

### 2.1 Flags belong to the role

The parent technical spec puts `can_view`, `can_edit`, and `can_delete` on `permissions`, with one row per page. That cannot express Administrator and Viewer differently on the same page. Move the flags onto the link.

```text
permissions (
  id,
  resource_type text not null default 'page',
  resource_key text not null,
  unique (resource_type, resource_key)
)

role_permissions (
  role_id → roles,
  permission_id → permissions,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key (role_id, permission_id)
)
```

`permissions` is the catalog of pages. Seed one row per key in section 2.4. A role grants a page by a `role_permissions` row.

Checking Edit or Delete in the role screen also sets View. Clearing View clears Edit and Delete. The API applies the same rule if a client sends Edit without View.

### 2.2 Users

```text
users (
  id,
  username text not null unique,          -- trimmed, stored as typed; unique including soft-deleted
  display_name text not null default '',
  email text null,                         -- unique when not null, including soft-deleted
  password_hash text not null,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  updated_by → users null
)
```

Unique email is a unique index on `email` where `email` is not null. PostgreSQL already allows many nulls.

Soft delete sets `deleted_at` and `is_active = false`, and removes that user’s `user_roles` and `user_sites` rows. The user row stays, so the username and email stay reserved. The list query is `deleted_at is null`.

Password hash is bcrypt, cost 12. No API returns `password_hash`, a password, or a token body.

### 2.3 Sites available for assignment

`sites` gains `is_active boolean not null default true`. The assignment dialog lists only rows with `is_active = true`, ordered by name. A save that ticks an unknown or inactive site returns `SITE_UNAVAILABLE` and writes nothing.

### 2.4 Page catalog

Seed these `resource_key` values. Labels on the role screen use the same Indonesian and English strings as the sidebar.

| Group | resource_key |
| --- | --- |
| Operations | `live-ops`, `ops-analytics`, `qc`, `daily-production`, `refinery-fractionation`, `utility`, `coverage` |
| Master | `master-companies`, `master-sites`, `master-plants`, `master-commodities`, `master-calibration`, `master-tanks`, `master-logsheets`, `master-quality-rules` |
| Administration | `admin-users`, `admin-roles` |

### 2.5 Seeded roles and the first user

| Role | is_system_role | Grants |
| --- | --- | --- |
| Administrator | true | View, edit, and delete on every key in section 2.4 |
| Viewer | true | View only on `live-ops`, `ops-analytics`, `qc`, and `daily-production` |

The seed reads `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` from the environment, hashes the password, and does not write it back. That user receives the Administrator role and one `user_sites` row for Bekasi. An empty site list is never treated as all sites.

Further persona roles (Site Manager, QC, Production, Utility, Tank Farm, Group Viewer, Master Data) are created on the Role Management screen. They are not seeded.

### 2.6 Audit

```text
access_audit (
  id bigint generated always as identity,
  actor_user_id → users,
  action text not null,
  entity_type text not null,             -- 'user' or 'role'
  entity_id text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
)
```

Write a row for user create, update, deactivate, password reset, role replacement, site replacement, and soft delete, and for role create, update, permission replacement, and delete. `detail` may list role ids and site ids. It must not contain a password or a hash.

---

## 3. Session

| Item | Value |
| --- | --- |
| Cookie name | `pid_session` |
| Contents | JWT, `sub` = user id, expiry 8 hours |
| Flags | HttpOnly, Path=/, SameSite=Lax, Max-Age 8 hours. Secure when `COOKIE_SECURE=true` |
| Storage in the browser | Cookie only. No `localStorage` token |

`JWT_EXPIRES_IN` for this module is `8h`. A refresh, or a later visit in the same browser inside that window, sends the cookie and `GET /auth/me` opens the dashboard without showing the form.

The JWT does not carry roles or sites. Every authenticated request loads the user and resolves permissions from the database, so a role or site change applies on the next request.

A cookie for an unknown, inactive, or soft-deleted user is cleared and the response is 401. An expired cookie is the same 401. The client then shows the sign-in page and does not render the shell.

Login failures, unknown usernames, wrong passwords, inactive users, and deleted users all return the same code: `INVALID_CREDENTIALS`. The client shows “Invalid username or password.” / “Nama pengguna atau kata sandi salah.” It clears the password field and stays on `/login`.

A blank username or password is rejected in the browser with “Username and password are required.” / “Nama pengguna dan kata sandi wajib diisi.” That case does not call `POST /auth/login`.

Limit login attempts to 10 failures per username per 15 minutes. A limited attempt returns `INVALID_CREDENTIALS`.

### 3.1 Route guard

`LocaleProvider` wraps the router so the EN / ID switch works on the sign-in page. The sign-in route renders outside `AppShell`. Every other route is a child of the shell and waits for `GET /auth/me`.

| `GET /auth/me` | Address | What renders |
| --- | --- | --- |
| 401 | Any path, including a bookmark under Live Operations, QC, Daily Production, Utility, Refinery, Master, or Administration | The sign-in page only. The shell is not mounted |
| 200 | `/login` | Replace `/login` with the landing page in section 3.2. The form is not shown |
| 200 | Any other path the role may view | That page |
| 200 | A path the role may not view | The access-denied card, or the empty-access card when `sites` is empty |

On sign-out, and on a 401, navigate to `/login` with history replace, not push. The shell unmounts first. A `pageshow` check calls `/auth/me` again so a restored page from the back button cannot keep the menus on screen without a session.

When a visitor without a session asks for a dashboard path, store that path and query string in `sessionStorage` under `pid.returnTo`. Store only a same-origin path that starts with `/` and is not `/login`. Do not store it in `localStorage`.

### 3.2 Where sign-in lands

After a 204 from `POST /auth/login`, read `pid.returnTo`, then remove the key.

1. If that path’s page key is one the user can view, open it.
2. Otherwise open the first page in this order that the user can view: `live-ops`, `ops-analytics`, `qc`, `daily-production`, `refinery-fractionation`, `utility`, `coverage`, then the master keys, then `admin-users`, then `admin-roles`.
3. If the user has no site, open the empty-access card.
4. If the user has sites and no view on any page, open the access-denied card.

Opening `/login` with a valid session uses the same landing rule and ignores `pid.returnTo`.

---

## 4. How a request is allowed

Both checks are required for operational and master data.

1. The site on the request is in `user_sites` for this user.
2. The union of the user’s roles has the required flag on that page key.

Union, per page key: View if any role has `can_view`, Edit if any has `can_edit`, Delete if any has `can_delete`.

| Situation | Result |
| --- | --- |
| No cookie, or inactive user | 401. The client goes to `/login` |
| Signed in, `user_sites` empty, operational or master route | 403 `NO_SITE`. The shell shows the empty-access card in PID-FSD-002 section 7.2. The account menu still works |
| Signed in, site not assigned | 403 `FORBIDDEN`. No row from that site is included in a group total |
| Signed in, site assigned, page flag missing | 403 `FORBIDDEN`. The shell shows the access-denied card in PID-FSD-002 section 7.4 |
| Company row | View requires `master-companies` view and at least one assigned site under that company. Edit requires `master-companies` edit as well |

The sidebar renders only page keys with View. Administration appears when either admin key has View. Edit and Delete buttons render only when that flag is set.

---

## 5. API

Base path `/api/v1`. Success bodies are the objects below, not wrapped in `{ success, data }`. Errors are `{ "code": "<CODE>" }` with the HTTP status in this section. The client maps `code` to the English and Indonesian sentences in PID-FSD-002. It does not display a raw server sentence.

### 5.1 Auth

| Method | Path | Auth | Body | Success |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Public | `{ "username", "password" }` | 204. Sets `pid_session` for 8 hours. 401 `INVALID_CREDENTIALS` for an unknown username, a wrong password, an inactive user, or a deleted user. The client does not call this route when either field is blank |
| POST | `/auth/logout` | Cookie | — | 204. Clears the cookie |
| GET | `/auth/me` | Cookie | — | The caller, as in section 5.4 |
| POST | `/auth/change-password` | Cookie | `{ "currentPassword", "newPassword" }` | 204. Session stays. Codes: `CURRENT_PASSWORD_REQUIRED`, `NEW_PASSWORD_REQUIRED`, `PASSWORD_TOO_SHORT`, `PASSWORD_UNCHANGED`, `INVALID_CURRENT_PASSWORD` |

The change-password dialog also checks that confirmation matches before it calls the API (`PASSWORD_MISMATCH` is client-only). New must differ from current. Minimum length is 6. An inactive user never reaches this route.

### 5.2 Users

All of these require a cookie. View requires `admin-users` view. Writes require edit, except delete, which requires delete.

| Method | Path | Success |
| --- | --- | --- |
| GET | `/admin/users` | Array of user rows, `deleted_at is null`, each with `roles` and `sites` |
| POST | `/admin/users` | 201 and the created row |
| PUT | `/admin/users/:id` | 200 and the updated row |
| DELETE | `/admin/users/:id` | 204 |

Create and update body:

```json
{
  "username": "string",
  "password": "string or omitted",
  "displayName": "string",
  "email": "string or null",
  "isActive": true,
  "roleIds": ["..."],
  "siteIds": ["..."]
}
```

The server trims username, display name, and email. Blank email is stored as null. Blank display name is stored as `""`. Username is required. Password is required on create and optional on update. A blank password on update does not change the hash. When a password is present it must be at least 6 characters.

The server writes the user, replaces `user_roles` with `roleIds`, then replaces `user_sites` with `siteIds`, in that order, inside one transaction. A failure rolls the transaction back. The dialog stays open. The stored site list is exactly `siteIds`. Role ids that are absent are detached.

| Code | HTTP | When |
| --- | --- | --- |
| `USERNAME_REQUIRED` | 400 | Username empty after trim |
| `PASSWORD_REQUIRED` | 400 | Create without a password |
| `PASSWORD_TOO_SHORT` | 400 | Password present and shorter than 6 |
| `USERNAME_TAKEN` | 409 | Username matches any user, including soft-deleted |
| `EMAIL_TAKEN` | 409 | Email matches any user, including soft-deleted |
| `SITE_UNAVAILABLE` | 409 | A site id is missing or `is_active` is false |
| `LAST_ADMIN` | 409 | This change would leave no active, non-deleted user who holds the Administrator role |
| `CANNOT_DEACTIVATE_SELF` | 409 | `isActive` false on the caller |
| `CANNOT_DELETE_SELF` | 409 | Delete of the caller |
| `FORBIDDEN` | 403 | Missing page permission |

Delete is the soft delete in section 2.2. It is also refused with `LAST_ADMIN` when the target is the last active administrator.

`GET /admin/users` is the full non-deleted list. Sort and column filters in PID-FSD-002 section 4.3 run in the browser.

### 5.3 Roles

View requires `admin-roles` view. Create and update require edit. Delete requires delete.

| Method | Path | Success |
| --- | --- | --- |
| GET | `/admin/roles` | All roles, with `userCount` and `isSystemRole` |
| GET | `/admin/roles/:id` | The role plus one entry per catalog page, with `canView`, `canEdit`, `canDelete` |
| POST | `/admin/roles` | 201 |
| PUT | `/admin/roles/:id` | 200 |
| DELETE | `/admin/roles/:id` | 204 |

Create and update body:

```json
{
  "name": "string",
  "description": "string",
  "permissions": [
    { "resourceKey": "live-ops", "canView": true, "canEdit": false, "canDelete": false }
  ]
}
```

Name is trimmed and required. Uniqueness is case-insensitive. A system role’s name cannot be changed. Its description and its permission rows can. `DELETE` of a system role returns `SYSTEM_ROLE`. `DELETE` of a role with `userCount > 0` returns `ROLE_IN_USE`. Permission replacement is one transaction. Omitted catalog keys are stored as all three flags false.

| Code | HTTP | When |
| --- | --- | --- |
| `ROLE_NAME_REQUIRED` | 400 | Name empty after trim |
| `ROLE_NAME_TAKEN` | 409 | Another role has the same name, ignoring case |
| `SYSTEM_ROLE` | 409 | Delete, or rename, of a system role |
| `ROLE_IN_USE` | 409 | Delete while any non-deleted user still has the role |

### 5.4 Caller payload

`GET /auth/me` and each user row returned to an administrator:

```json
{
  "id": "…",
  "username": "…",
  "displayName": "…",
  "email": null,
  "isActive": true,
  "roles": [{ "id": "…", "name": "Viewer", "isSystemRole": true }],
  "sites": [{ "id": "bekasi", "name": "Bekasi", "timezone": "Asia/Jakarta" }],
  "permissions": [{ "resourceKey": "live-ops", "canView": true, "canEdit": false, "canDelete": false }]
}
```

`permissions` is the union. It is present on `/auth/me`. It is omitted from the user list. The list still includes role names and site names for the table.

`GET /admin/sites` returns active sites (`id`, `name`, `timezone`) for the assignment dialog. It requires `admin-users` view. `GET /admin/roles` for the checkbox list requires `admin-users` view as well, so an administrator who can edit users can load roles without also holding `admin-roles`.

---

## 6. User Management screen

Implements PID-FSD-002 sections 3 to 6. Copy is taken from that document. Do not paraphrase the toast, validation, or empty-state sentences.

### 6.1 Administration

Sidebar label: Administration / Administrasi. The page shows a card grid in the master-menu style.

| Card | English | Indonesian | Shown when |
| --- | --- | --- | --- |
| Users | User Management. Manage users, assign roles, and assign sites. | Manajemen Pengguna. Kelola pengguna, tetapkan peran, dan tetapkan site. | `admin-users` view |
| Roles | Role Management. Manage roles and the pages each role can open. | Manajemen Peran. Kelola peran dan halaman yang dapat dibuka tiap peran. | `admin-roles` view |

User Management has a “Back to Administration” / “Kembali ke Administrasi” link under the title.

### 6.2 List

Title User Management / Manajemen Pengguna. Card title Users / Pengguna. Add User / Tambah Pengguna is visible only with edit permission.

Columns, sort, filters, inactive-row treatment, loading, error, and empty copy are PID-FSD-002 sections 4.1 to 4.3. Default sort is display name, then username, A to Z. Deleted users are not in the payload.

Actions: Edit with edit permission. Delete with delete permission. Delete confirms with the sentence in PID-FSD-002 section 6, then calls `DELETE`.

Toast, about three seconds: the save and delete sentences in PID-FSD-002 section 4.4. The save toast includes the site count returned on the saved user. A failure toast uses the mapped sentence for the error code.

### 6.3 Dialog

Add User / Tambah Pengguna and Edit User / Ubah Pengguna. Backdrop, Cancel, and Escape close it when a save is not in progress. Escape does nothing while the save request is outstanding.

Fields, locked username on edit, optional password on edit, role checkboxes in two columns with the “(system)” / “(sistem)” suffix, and the site search with Select visible / Clear visible are PID-FSD-002 sections 5.1 to 5.3. Only active sites are listed. Select visible and Clear visible affect the sites in the current search, not the sites the search is hiding.

Save sends one `POST` or `PUT` as in section 5.2. The button label becomes Saving… / Menyimpan… and is disabled until the response. Success closes the dialog and reloads the list. Failure leaves the dialog open.

Validation messages are the table in PID-FSD-002 section 5.5, chosen from the error code.

---

## 7. Role Management screen

### 7.1 List

Title Role Management / Manajemen Peran. Card title Roles / Peran. Add Role / Tambah Peran requires edit permission.

| Column | English | Indonesian | Contents |
| --- | --- | --- | --- |
| Role | Role | Peran | Name. Suffix “(system)” / “(sistem)” when `isSystemRole` |
| Description | Description | Deskripsi | Description, or an em dash |
| Users | Users | Pengguna | `userCount` |
| Actions | | | Edit with edit permission. Delete with delete permission, hidden when `isSystemRole` is true or `userCount` is greater than 0 |

Default sort is name, A to Z. Empty list: “No roles yet.” / “Belum ada peran.”

### 7.2 Dialog

Add Role / Tambah Peran. Edit Role / Ubah Peran. Name and description. Name is locked when `isSystemRole` is true.

Under the fields, a table grouped Operations / Operasi, Master / Master, and Administration / Administrasi. Each page is a row. Columns are View / Lihat, Edit / Ubah, and Delete / Hapus. The checkbox rule is section 2.1.

Save replaces the permission set. Success toast: “Role saved.” / “Peran disimpan.” Delete confirms: “Delete this role?” / “Hapus peran ini?” Success toast: “Role deleted.” / “Peran dihapus.” `ROLE_IN_USE` and `SYSTEM_ROLE` stay on the dialog: “This role is still assigned to a user.” / “Peran ini masih ditetapkan ke pengguna.” and “A system role cannot be deleted.” / “Peran sistem tidak dapat dihapus.”

---

## 8. Sign-in page

Implements PID-FSD-002 section 7.1. The page is one card. It does not mount the sidebar or the top bar. Copy is taken from that section. Do not paraphrase it.

| | English | Indonesian |
| --- | --- | --- |
| Title | Welcome back | Selamat datang kembali |
| Introduction | Sign in to continue to Plant Information Dashboard | Masuk untuk melanjutkan ke Plant Information Dashboard |
| Username label | Username | Nama pengguna |
| Username placeholder | Enter username | Masukkan nama pengguna |
| Password label | Password | Kata sandi |
| Password placeholder | Enter password | Masukkan kata sandi |
| Show / hide password | Show password / Hide password | Tampilkan kata sandi / Sembunyikan kata sandi |
| Submit | Sign in | Masuk |
| Submit while waiting | Signing in… | Sedang masuk… |

The EN / ID switch sits on the card. The password field is masked, with a control that toggles the input type. Sign in is disabled while `POST /auth/login` is in progress, and the label becomes Signing in… / Sedang masuk….

A failed sign-in stays on this page and clears the password field. A successful sign-in follows section 3.2.

Dashboard API calls without a cookie receive 401. The shell is not shown. The sign-in page is.

### 8.1 Empty access, sites, and the account menu

These are PID-FSD-002 sections 7.2 to 7.6.

| Assigned sites | Shell |
| --- | --- |
| None | The empty-access card. Account menu remains. Operational routes are not called. Back to sign-in signs out, then opens `/login` |
| One | That site is selected. Name and timezone show in the top bar |
| More than one | The user picks a site before operational data loads. The switcher lists only assigned sites. A group view includes only those sites |

The top-bar chip shows the display name, or the username when the display name is empty, and initials from that label. The menu shows the display name, the username, Change password / Ubah Kata Sandi, and Sign out / Keluar. Sign-out calls `POST /auth/logout`, clears `pid.returnTo`, and replaces the history entry with `/login`.

Change password uses the three masked fields and the checks in PID-FSD-002 section 7.6. Success closes the dialog and leaves the cookie in place. The next login uses the new password.

An administrator reset is the optional password on Edit User. It does not ask for the target user’s current password.

---

## 9. Acceptance

User Management acceptance is PID-FSD-002 section 9. In addition:

1. Viewer signed in at Bekasi sees Tank Farm, QC, and Daily Production, and does not see Administration.
2. Unticking Bekasi and signing in again shows “No site assigned.” / “Akses belum dikonfigurasi”.
3. A site assigned only to another user is absent from the switcher and from a group total.
4. Edit with a blank password leaves the hash unchanged.
5. A username or email used by a soft-deleted user is rejected with `USERNAME_TAKEN` or `EMAIL_TAKEN`.
6. Delete of the signed-in user and deactivation or deletion of the last active administrator are refused. The user remains on the list.
7. After a successful soft delete the user is absent from `GET /admin/users` and login returns `INVALID_CREDENTIALS`.
8. Change password succeeds only when the current password matches, the new password is at least 6 characters, and the confirmation matches.
9. A new role can be given view on `utility` only. A user with that role and Bekasi sees Utility and does not see User Management. Deleting that role while the user still has it returns `ROLE_IN_USE`. Deleting Viewer or Administrator returns `SYSTEM_ROLE`.
10. Every sentence cited from PID-FSD-002, including the sign-in card, and the Role Management sentences in section 7 of this document, exist in both languages.
11. A visitor who is not signed in, and who opens any dashboard address directly, sees the sign-in page. The sidebar and the module screens are not mounted. After a successful sign-in they land on that address when their role can view it, and otherwise on the first page their role allows.
12. An active user who signs in with the correct username and password reaches the dashboard. A refresh inside 8 hours stays signed in and does not show the form. Sign-out, or a session older than 8 hours, returns to the sign-in page, and the back button does not restore the menus.
13. An unknown username, a wrong password, an inactive user, and a deleted user all stay on the sign-in page with “Invalid username or password.” The password field is cleared. A blank username or password does not call the API.
