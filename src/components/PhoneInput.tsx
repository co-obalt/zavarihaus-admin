import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

const PRIORITY_COUNTRIES: CountryCode[] = ['PK', 'AE', 'SA', 'GB', 'US'];

function countryFlag(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function isValidPhoneValue(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = parsePhoneNumberFromString(value, 'PK');
  return Boolean(parsed?.isValid());
}

function toE164(country: CountryCode, national: string): string {
  const digits = national.replace(/[^\d]/g, '').replace(/^0+/, '');
  return digits ? `+${getCountryCallingCode(country)}${digits}` : '';
}

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function PhoneInput({ value, onChange, disabled, required }: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>('PK');
  const [national, setNational] = useState('');
  const [touched, setTouched] = useState(false);
  const lastEmitted = useRef('');

  // Sync from external value (returning-guest autofill, form reset)
  useEffect(() => {
    if (value === lastEmitted.current) return;
    if (!value) {
      setNational('');
      return;
    }
    const parsed = parsePhoneNumberFromString(value, 'PK');
    if (parsed?.country) {
      setCountry(parsed.country);
      setNational(parsed.formatNational().replace(/^0/, ''));
    } else {
      setNational(value);
    }
  }, [value]);

  const countries = useMemo(() => {
    const all = getCountries()
      .map((iso) => ({
        iso,
        name: regionNames.of(iso) || iso,
        dialCode: getCountryCallingCode(iso),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const priority = PRIORITY_COUNTRIES.map((p) => all.find((c) => c.iso === p)!).filter(Boolean);
    const rest = all.filter((c) => !PRIORITY_COUNTRIES.includes(c.iso));
    return [...priority, ...rest];
  }, []);

  const emit = (nextCountry: CountryCode, nextNational: string) => {
    const e164 = toE164(nextCountry, nextNational);
    lastEmitted.current = e164;
    onChange(e164);
  };

  const handleCountryChange = (iso: CountryCode) => {
    setCountry(iso);
    emit(iso, national);
  };

  const handleNumberChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    const formatted = new AsYouType(country).input(digits);
    setNational(formatted || raw);
    emit(country, digits);
  };

  const digits = national.replace(/[^\d]/g, '');
  const valid = digits.length > 0 && isValidPhoneNumber(digits, country);
  const showError = touched && digits.length > 0 && !valid;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-stretch gap-2 bg-slate-50 border rounded-xl overflow-hidden focus-within:bg-white transition ${
          showError ? 'border-rose-300' : 'border-slate-200 focus-within:border-indigo-500'
        } ${disabled ? 'opacity-75' : ''}`}
      >
        <select
          value={country}
          disabled={disabled}
          onChange={(e) => handleCountryChange(e.target.value as CountryCode)}
          className="bg-transparent pl-2.5 text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[75px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap pr-2 disabled:cursor-not-allowed"
          aria-label="Country"
        >
          {countries.map((c) => (
            <option key={c.iso} value={c.iso}>
              {countryFlag(c.iso)} {c.name} (+{c.dialCode})
            </option>
          ))}
        </select>
        <span className="self-center text-xs font-mono font-semibold text-slate-400 select-none shrink-0">
          +{getCountryCallingCode(country)}
        </span>
        <input
          type="tel"
          required={required}
          disabled={disabled}
          value={national}
          onChange={(e) => handleNumberChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="321 1234567"
          className="w-full bg-transparent p-3 pl-0 outline-none text-xs font-mono font-semibold text-slate-700 min-w-0 disabled:cursor-not-allowed"
          autoComplete="tel-national"
        />
      </div>
      {showError && (
        <p className="text-[10px] font-semibold text-rose-500">
          Invalid number for {regionNames.of(country)}.
        </p>
      )}
    </div>
  );
}
