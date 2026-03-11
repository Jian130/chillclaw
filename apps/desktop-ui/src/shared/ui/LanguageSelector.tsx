import { Globe } from "lucide-react";

import { useLocale, localeOptions } from "../../app/providers/LocaleProvider.js";

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();

  return (
    <label className="language-selector">
      <Globe size={16} />
      <select onChange={(event) => setLocale(event.target.value as typeof locale)} value={locale}>
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.flag} {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
