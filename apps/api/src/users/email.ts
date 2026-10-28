// Emails are stored lowercased; every handler that reads or writes the users
// table normalizes through here so lookups and inserts agree.
export function normalizeEmail(email: string): string {
  return email.toLowerCase();
}
