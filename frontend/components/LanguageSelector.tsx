"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Locale } from "@/lib/i18n/translations";

const languages: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "lg", label: "Luganda", flag: "🇺🇬" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
];

export default function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="text-sm bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-pink-500"
      aria-label="Select language"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.label}
        </option>
      ))}
    </select>
  );
}
