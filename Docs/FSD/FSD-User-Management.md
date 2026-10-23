# Functional Specification

## User Management

| | |
| --- | --- |
| Document ID | PID-FSD-002 |
| Version | 1.1 |
| Date | 20 October 2026 |
| Status | Draft for review |
| Audience | Product owners, IT, engineering |
| Parent | `Docs/FSD/FSD-Plant-Information-Dashboard.md` section 5 |
| Pattern | Jetty Planning System sign-in (`Login.jsx`), Admin → User Management (`AdminUsers.jsx`), and Change Password (`ChangePasswordModal.jsx`) |

Sites take the place Jetty gives to ports. A user is assigned one or more sites. Page rights still come from roles. This document specifies the screens that create those users and assign those sites. Role definitions are maintained on Role Management, which is a separate specification. This screen only assigns roles that already exist.

Single sign-on, departments, and partner-API administration from the Jetty admin hub are outside this release.

The screen uses the dashboard’s existing visual system (`tokens.css`, `shell.css`, `master.css`). Labels exist in English and Indonesian.

---

## 1. Purpose

An administrator can:

- see every user who can sign in
- create a user with a username and a password
- set the display name, email, and active flag
- assign one or more roles
- assign one or more sites
- reset a password
- retire a user without destroying the record

A registered, active user can sign in, stay signed in for the session, and then change their own password or sign out. A visitor who is not signed in sees the sign-in page and none of the dashboard menus.

Operators and mechanics still record the shift in LogSheet Builder. They do not need an account here.

---

## 2. Who can open it

The page key is `admin-users`.

| Permission | What it allows |
| --- | --- |
| View | Open User Management and read the list |
| Edit | Add a user, edit a user, assign roles, assign sites, set or reset a password, turn Active on or off |
| Delete | Delete a user |

A Viewer role does not receive this page. The Administrator role receives view, edit, and delete.

The signed-in user’s own password change and sign-out sit on the account menu in the top bar. They do not require `admin-users`.

---

## 3. Where it sits

User Management is reached from an Administration entry in the sidebar, visible when the user has view on `admin-users` or `admin-roles`.

The Administration page offers a card:

| English | Indonesian | Opens |
| --- | --- | --- |
| User Management | Manajemen Pengguna | The user list |
| Manage users, assign roles, and assign sites. | Kelola pengguna, tetapkan peran, dan tetapkan site. | |

A “Back to Administration” link sits under the User Management title.

---

## 4. User list

### 4.1 Layout

Title: **User Management** / **Manajemen Pengguna**.

A card titled **Users** / **Pengguna** contains the table and an **Add User** / **Tambah Pengguna** button. The button is shown when the signed-in user has edit permission.

While the list is loading, the card shows “Loading…” / “Memuat…”.

When the request fails, the card shows the error and leaves the table empty.

When the account has view and the list is genuinely empty, the card shows “No users yet.” / “Belum ada pengguna.”

### 4.2 Columns

| Column | English | Indonesian | Contents |
| --- | --- | --- | --- |
| User | User | Pengguna | Display name in emphasis. Username on the line beneath when a display name is set. Username alone when the display name is empty |
| Email | Email | Email | Email, or an em dash when empty |
| Roles | Roles | Peran | Role names, comma-separated, or an em dash when none are assigned |
| Sites | Sites | Site | Site names, comma-separated, or an em dash when none are assigned |
| Status | Status | Status | Badge: Active / Aktif, or Inactive / Nonaktif |
| Actions | | | Edit, and Delete when the signed-in user has delete permission |

Inactive rows are drawn lighter than active rows. Deleted users are absent from this list.

Default sort is User, A to Z.

### 4.3 Sort and filter

Each column header sorts ascending and descending. A second click on the same header reverses the direction.

| Column | Filter |
| --- | --- |
| User | Text. Matches display name or username |
| Email | Text |
| Roles | Multi-select of role names. A row matches when it has any selected role. Empty option label: “No roles” / “Tanpa peran”. All-roles choice clears the filter |
| Sites | Text. Matches the site names shown in the cell |
| Status | Choice: Active or Inactive |

When every row is filtered out, the table shows “No entries match the current filters.” / “Tidak ada data yang sesuai dengan filter.”

### 4.4 Feedback

A toast appears for about three seconds after a successful save, a successful delete, or a failed action.

| Event | English | Indonesian |
| --- | --- | --- |
| Save | User saved. {n} site(s) assigned. | Pengguna disimpan. {n} site ditetapkan. |
| Delete | User deleted. | Pengguna dihapus. |
| Failure | The message returned by the save or delete | The same message, translated where this specification gives the wording |

---

## 5. Add and edit

Add and Edit open the same dialog. Add is titled **Add User** / **Tambah Pengguna**. Edit is titled **Edit User** / **Ubah Pengguna**.

The dialog is wide enough for two columns of checkboxes. Clicking the backdrop, or Cancel, closes it without saving. Escape closes it while a save is not in progress.

Edit loads the user’s current roles and sites when the dialog opens. If that refresh fails, the dialog shows the error and keeps the assignments already known from the list.

### 5.1 Fields

| Field | Add | Edit | Rule |
| --- | --- | --- | --- |
| Username | Empty, required | Filled, locked | Trimmed. Stored exactly as typed after trimming. Unique among all users, including deleted users, so a retired username is not issued again |
| Password | Required | Optional. Label: “New password (optional)” / “Kata sandi baru (opsional)” | At least 6 characters when supplied. The typed value is hidden. On edit, a blank password leaves the current password in place |
| Display name | Optional | Optional | Trimmed. Blank is stored as empty |
| Email | Optional | Optional | Trimmed. Blank is stored as empty. When set, unique among all users, including deleted users |
| Active | Checked | As stored | Unchecked means the user cannot sign in |

Username is the sign-in name. It is not an email address unless the administrator types one.

### 5.2 Roles

Label: **Roles** / **Peran**.

Every role is listed as a checkbox in two columns, system roles included. A system role shows the suffix “(system)” / “(sistem)” after its name.

The administrator may tick any combination, including none. Permissions the user receives are the union of the ticked roles. Site assignment still limits which sites those permissions apply to.

Helper text: “Roles control which pages this user can view, edit, or delete.” / “Peran mengatur halaman yang dapat dilihat, diubah, atau dihapus pengguna ini.”

When the role list fails to load, the error is shown in the dialog and save of role changes waits until the list has loaded. The rest of the form stays usable.

When no roles exist, the section shows “No roles found.” / “Tidak ada peran.”

### 5.3 Sites

Label: **Site access** / **Akses site**.

This is the Jetty port-access block, bound to sites.

- Only active sites are listed, ordered by name.
- A search box filters the list by site name. The placeholder is “Search site…” / “Cari site…”.
- Checkboxes are two columns inside a scroll area.
- **Select visible** / **Pilih yang tampil** ticks every site in the current search.
- **Clear visible** / **Hapus yang tampil** unticks every site in the current search and leaves sites hidden by the search as they were.
- A site may be left unticked. An empty assignment is valid. That user can sign in and then sees the empty-access state in section 7.

Helper text: “A user with no site assigned cannot open operational or master data.” / “Pengguna tanpa site tidak dapat membuka data operasional maupun data master.”

When the site list fails to load, the error is shown and the site checkboxes are withheld until the list loads.

### 5.4 Actions

| Button | English | Indonesian | Behaviour |
| --- | --- | --- | --- |
| Cancel | Cancel | Batal | Closes the dialog. Nothing is written |
| Add | Add | Tambah | Shown on create. Disabled while the save is in progress, and the label becomes “Saving…” / “Menyimpan…” |
| Save | Save | Simpan | Shown on edit. Same disabled state |

Save writes the user, then the role assignment, then the site assignment. The site list stored at the end is exactly the ticked sites. Roles that were added are attached. Roles that were removed are detached. A failure on any step leaves the dialog open with the error, and the toast reports the failure. A full success closes the dialog, reloads the list, and shows the save toast with the number of sites now assigned.

### 5.5 Validation messages

Shown in the dialog, in the active language.

| Situation | English | Indonesian |
| --- | --- | --- |
| Username blank | Username is required. | Nama pengguna wajib diisi. |
| Password blank on create | Password is required for a new user. | Kata sandi wajib diisi untuk pengguna baru. |
| Password shorter than 6 characters | Password must be at least 6 characters. | Kata sandi minimal 6 karakter. |
| Username already used | Username is already in use. | Nama pengguna sudah digunakan. |
| Email already used | Email is already in use. | Email sudah digunakan. |
| A ticked site is inactive or unknown | One or more sites are no longer available. | Satu atau lebih site sudah tidak tersedia. |
| Deactivating the last active administrator | At least one active administrator must remain. | Minimal satu administrator aktif harus tetap ada. |
| Deactivating the signed-in account | You cannot deactivate your own account. | Anda tidak dapat menonaktifkan akun Anda sendiri. |

---

## 6. Delete

Delete asks for confirmation: “Delete this user? They will no longer be able to sign in.” / “Hapus pengguna ini? Mereka tidak akan bisa masuk lagi.”

Confirming performs a soft delete. The row remains stored. The user disappears from the list, cannot sign in, and loses role and site assignments for access purposes. The username and email stay reserved.

| Situation | English | Indonesian |
| --- | --- | --- |
| Deleting the signed-in account | You cannot delete your own account. | Anda tidak dapat menghapus akun Anda sendiri. |
| Deleting the last active administrator | At least one active administrator must remain. | Minimal satu administrator aktif harus tetap ada. |

Delete is refused in both cases. The user stays on the list.

---

## 7. What the assigned user experiences

### 7.1 Sign-in page

The sign-in page is the only screen available without a session. There is no self-registration and no single sign-on on this page. An account exists only after an administrator creates it in User Management.

#### 7.1.1 Layout

The page is a single card on the dashboard’s existing visual system. It does not show the sidebar, the top bar, or any module.

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

The language switch (EN / ID) is on this page, so the labels can be read before sign-in. The password field is masked, with a control to show or hide it. The submit button is disabled while the sign-in request is in progress.

#### 7.1.2 Who can sign in

Sign-in uses the username and password stored for that user. The username is the sign-in name from User Management.

| Result | What the user sees |
| --- | --- |
| Username and password match an active user | A session starts and the dashboard opens |
| Username or password is blank | “Username and password are required.” / “Nama pengguna dan kata sandi wajib diisi.” The request is not sent |
| The password does not match, or the username is unknown | “Invalid username or password.” / “Nama pengguna atau kata sandi salah.” The message does not say which of the two was wrong |
| The account is inactive or deleted | The same invalid-credentials message |

A failed attempt leaves the visitor on the sign-in page. The password field is cleared.

#### 7.1.3 Session

A successful sign-in keeps the user signed in.

- The session is an HttpOnly cookie. The browser does not store the token in `localStorage`.
- The session lasts 8 hours. A refresh, or a later visit in the same browser inside that window, opens the dashboard directly.
- Signing out clears the session and returns to the sign-in page.
- When the 8 hours have passed, the next request ends the session and shows the sign-in page.
- Opening the sign-in page while the session is still valid skips the form and opens the dashboard.

The password itself remains stored only as a hash.

#### 7.1.4 Closed dashboard

Every dashboard route requires a session. That includes Live Operations, Quality Control, Daily Production, Utility, Refinery, Master, Administration, and any bookmarked address under those menus.

| Visitor | What opens |
| --- | --- |
| No session | The sign-in page. The sidebar and the module screens are not rendered |
| Session just ended, or sign-out | The sign-in page. The previous menu does not remain reachable through the back button |
| Valid session, and the address they asked for is a page they may view | That page |
| Valid session, and they opened the sign-in page itself | The dashboard, on the first page their role allows |

When a visitor without a session asks for a page inside the dashboard, the sign-in page remembers that address. After a successful sign-in they land on it, provided their role can view it. Otherwise they land on the first page their role allows.

Dashboard data requests without a session are refused. The screen that follows is the sign-in page.

### 7.2 No site assigned

When the signed-in user has no site, operational and master pages are replaced by one card:

| | English | Indonesian |
| --- | --- | --- |
| Title | Access not configured | Akses belum dikonfigurasi |
| Body | No site assigned. Contact a Plant Information Dashboard administrator. | Tidak ada site yang ditetapkan. Hubungi administrator Plant Information Dashboard. |
| Action | Back to sign-in | Kembali ke halaman masuk |

The account menu remains available so the user can sign out.

### 7.3 One site or many

| Assigned sites | Behaviour |
| --- | --- |
| One | That site is selected. Its name and timezone show in the top bar |
| More than one | The user chooses a site before operational data loads. The switcher lists only assigned sites. A group view, where the parent specification provides one, includes only those sites |

A site removed from the assignment disappears from the switcher on the next load. Data for a site outside the assignment is not returned.

### 7.4 No page permission

A user with sites and with no view right on the current page sees:

| | English | Indonesian |
| --- | --- | --- |
| Title | Access denied | Akses ditolak |
| Body | You do not have permission to view this page. | Anda tidak memiliki izin untuk melihat halaman ini. |

The sidebar shows only pages the user’s roles allow.

### 7.5 Account menu

The top-bar chip shows the display name, or the username when the display name is empty, and initials taken from that label.

Opening the chip shows:

- the display name and username
- **Change password** / **Ubah Kata Sandi**
- **Sign out** / **Keluar**

Sign-out ends the session and returns to the sign-in screen.

### 7.6 Change own password

The dialog has three masked fields, each with show and hide:

| Field | English | Indonesian |
| --- | --- | --- |
| Current | Current Password | Kata Sandi Saat Ini |
| New | New Password | Kata Sandi Baru |
| Confirm | Confirm Password | Konfirmasi Kata Sandi |

| Check | English | Indonesian |
| --- | --- | --- |
| Current is empty | Current password is required. | Kata sandi saat ini wajib diisi. |
| New is empty | New password is required. | Kata sandi baru wajib diisi. |
| New is shorter than 6 characters | New password must be at least 6 characters. | Kata sandi baru minimal 6 karakter. |
| Confirm differs | New password and confirmation do not match. | Kata sandi baru dan konfirmasi tidak cocok. |
| New equals current | New password must be different from your current password. | Kata sandi baru harus berbeda dari kata sandi saat ini. |
| Current is wrong | Invalid current password. | Kata sandi saat ini salah. |
| Success | Your password has been updated. | Kata sandi Anda telah diperbarui. |

On success the dialog closes. The user stays signed in.

An inactive user cannot change a password. An administrator reset from User Management does not ask for the user’s current password.

---

## 8. Rules carried forward

These already stand in the parent specification and the technical baseline. User Management must implement them.

| ID | Rule |
| --- | --- |
| UM-01 | An empty site assignment means no sites. It does not mean every site |
| UM-02 | The first administrator is created by seed, given the Administrator role, and given Bekasi explicitly. The seed password is read from the environment and is not written back out |
| UM-03 | A person may hold more than one role. Rights are the union of those roles, still limited to the assigned sites |
| UM-04 | The last active user who holds the Administrator role cannot be deactivated or deleted |
| UM-05 | The signed-in user cannot deactivate or delete their own account |
| UM-06 | A deleted user is hidden from the list and cannot sign in. The username and email remain reserved |
| UM-07 | Passwords are stored as a hash and are never returned to the browser |
| UM-08 | Create, update, deactivate, role changes, site changes, and delete record the acting user and the time |

---

## 9. Acceptance

1. An administrator adds a user with a username, a password of at least 6 characters, the Viewer role, and Bekasi. That user signs in and sees Tank Farm, QC, and Daily Production for Bekasi, and does not see User Management.
2. The same user with Bekasi unticked signs in and sees “No site assigned.”
3. A second site assigned only to a different user stays invisible to the Bekasi user, including in a group total.
4. Editing the user and leaving the password blank does not change the password.
5. A username or email that already belongs to a user, including a deleted user, is rejected.
6. Deleting the signed-in administrator is refused. Deactivating or deleting the only remaining active administrator is refused.
7. After a soft delete, the user is gone from the list and cannot sign in.
8. From the account menu, a user changes their password only when the current password is correct, the new password is at least 6 characters, and the confirmation matches. The next sign-in uses the new password.
9. Every label in this specification is available in English and Indonesian.
10. A visitor who is not signed in, and who opens any dashboard address directly, sees the sign-in page. The sidebar and the module screens are not shown.
11. An active registered user who signs in with the correct username and password reaches the dashboard. A refresh inside the 8-hour session keeps them signed in. Sign-out, or a session older than 8 hours, returns them to the sign-in page.
12. An unknown username, a wrong password, an inactive user, and a deleted user all stay on the sign-in page with “Invalid username or password.”
