// Business timezone for all operational displays (kitchen queue, emails,
// customer-facing times). All current locations are Ohio; when the business
// spans timezones, promote this to a Location.timezone column and thread it
// per-location. Matches the existing hard-codes in email.ts + chat-hours.ts.
export const BUSINESS_TIMEZONE = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE || 'America/New_York';
