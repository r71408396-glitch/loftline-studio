// Delivery window for a ZIP / postal code / postcode:
//   ready to ship = order day (next working day after the 2 pm cut-off) + the
//                   longest lead time of the parts (working days)
//   delivered     = ready + carrier transit days for the destination zone
// Weekends and the public holidays below are skipped.
//
// Ships from: Columbus, Ohio (US), Toronto (Canada), Birmingham (UK).

export type Country = 'US' | 'CA' | 'GB';
export type Window = {
  country: Country;
  zone: string;
  leadDays: number;
  transitDays: [number, number];
  shipsOn: string; // YYYY-MM-DD
  earliest: string;
  latest: string;
};

export class DeliveryError extends Error {}

const CUTOFF_HOUR = 14;
const TIME_ZONES: Record<Country, string> = { US: 'America/New_York', CA: 'America/Toronto', GB: 'Europe/London' };

// US: first digit of the ZIP, from Columbus, Ohio.
const US_ZONES: Record<string, [string, [number, number]]> = {
  '0': ['Northeast', [2, 4]],
  '1': ['New York and Pennsylvania', [2, 3]],
  '2': ['Mid-Atlantic', [2, 3]],
  '3': ['Southeast', [3, 4]],
  '4': ['Midwest (near the warehouse)', [1, 2]],
  '5': ['Upper Midwest', [2, 4]],
  '6': ['Central', [2, 4]],
  '7': ['South Central', [3, 5]],
  '8': ['Mountain', [4, 6]],
  '9': ['West Coast, Alaska and Hawaii', [5, 7]],
};

// Canada: first letter of the postal code, from Toronto.
const CA_ZONES: [string, string, [number, number]][] = [
  ['KLMNP', 'Ontario', [1, 3]],
  ['GHJ', 'Quebec', [2, 4]],
  ['ABCE', 'Atlantic Canada', [4, 7]],
  ['RST', 'Prairies', [4, 6]],
  ['V', 'British Columbia', [5, 8]],
  ['XY', 'Northern Canada', [8, 14]],
];

// UK: postcode areas that take longer from Birmingham.
const GB_REMOTE = ['BT', 'HS', 'IV', 'KW', 'PA', 'PH', 'ZE', 'TR21', 'TR22', 'TR23', 'TR24', 'TR25', 'IM', 'GY', 'JE'];

// Public holidays the carriers don't deliver on (2026-2027).
const HOLIDAYS: Record<Country, string[]> = {
  US: ['2026-11-26', '2026-12-25', '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24'],
  CA: ['2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-05-24', '2027-07-01', '2027-09-06', '2027-10-11', '2027-12-27'],
  GB: ['2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28'],
};

export function normalisePostalCode(country: Country, raw: string): string {
  const code = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (country === 'US' && /^\d{5}(-\d{4})?$/.test(code)) return code.slice(0, 5);
  if (country === 'CA' && /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(code)) return code.replace(' ', '');
  if (country === 'GB' && /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/.test(code)) return code.replace(' ', '');
  throw new DeliveryError('Enter a valid ZIP or postcode.');
}

export function zoneFor(country: Country, code: string): [string, [number, number]] {
  if (country === 'US') return US_ZONES[code[0]];
  if (country === 'CA') {
    const zone = CA_ZONES.find(([letters]) => letters.includes(code[0]));
    if (!zone) throw new DeliveryError('Enter a valid ZIP or postcode.');
    return [zone[1], zone[2]];
  }
  const outward = code.slice(0, -3);
  const remote = GB_REMOTE.some((prefix) => outward.startsWith(prefix) && /\d/.test(outward.slice(prefix.length, prefix.length + 1) || '0'));
  return remote ? ['Northern Ireland, Highlands and islands', [3, 5]] : ['Mainland UK', [1, 2]];
}

// Dates are handled as plain calendar days (UTC midnight) in the destination's time zone.
const toDay = (date: Date, timeZone: string) => {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).split('-');
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
};
const hourIn = (date: Date, timeZone: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(date));
const iso = (day: Date) => day.toISOString().slice(0, 10);

function isWorkingDay(day: Date, country: Country) {
  const weekday = day.getUTCDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS[country].includes(iso(day));
}

function addWorkingDays(day: Date, days: number, country: Country) {
  const next = new Date(day);
  let left = days;
  while (left > 0) {
    next.setUTCDate(next.getUTCDate() + 1);
    if (isWorkingDay(next, country)) left--;
  }
  return next;
}

export function deliveryWindow(input: { country: string; postalCode: string; leadDays: number; now?: Date }): Window {
  const country = input.country.toUpperCase() as Country;
  if (!(country in TIME_ZONES)) throw new DeliveryError('We deliver to the US, Canada and the UK.');
  const code = normalisePostalCode(country, input.postalCode);
  const [zone, transit] = zoneFor(country, code);
  const leadDays = Math.max(0, Math.min(60, Math.round(Number(input.leadDays) || 0)));

  const timeZone = TIME_ZONES[country];
  const now = input.now ?? new Date();
  let start = toDay(now, timeZone);
  // Orders after the cut-off, or on a day off, start counting from the next working day.
  if (!isWorkingDay(start, country) || hourIn(now, timeZone) >= CUTOFF_HOUR) start = addWorkingDays(start, 1, country);

  const shipsOn = addWorkingDays(start, leadDays, country);
  return {
    country,
    zone,
    leadDays,
    transitDays: transit,
    shipsOn: iso(shipsOn),
    earliest: iso(addWorkingDays(shipsOn, transit[0], country)),
    latest: iso(addWorkingDays(shipsOn, transit[1], country)),
  };
}
