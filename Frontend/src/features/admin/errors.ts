import type { Messages } from '../../i18n/messages.ts'

const CODES: Record<string, keyof Messages> = {
  invalid_credentials: 'loginInvalid',
  username_required: 'usernameRequired',
  password_required: 'passwordRequired',
  password_short: 'passwordShort',
  username_taken: 'usernameTaken',
  email_taken: 'emailTaken',
  last_admin: 'lastAdmin',
  self_deactivate: 'selfDeactivate',
  self_delete: 'selfDelete',
  current_password_required: 'currentPasswordRequired',
  new_password_required: 'newPasswordRequired',
  same_password: 'samePassword',
  bad_current_password: 'badCurrentPassword',
  role_name_required: 'roleNameRequired',
  role_name_taken: 'roleNameTaken',
  system_role: 'systemRoleLocked',
  role_in_use: 'roleInUse',
  forbidden: 'accessDeniedBody',
}

export function errorText(t: Messages, code: string) {
  const key = CODES[code]
  return key ? t[key] : t.requestFailed
}
