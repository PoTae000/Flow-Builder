import { en, type TranslationKey } from './en';
import { th } from './th';

export type Locale = 'en' | 'th';
export type { TranslationKey };

const translations: Record<Locale, Record<TranslationKey, string>> = { en, th };

class I18nState {
	locale = $state<Locale>('th');

	constructor() {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('locale');
			if (saved === 'en' || saved === 'th') {
				this.locale = saved;
			}
		}
	}

	t(key: TranslationKey): string {
		return translations[this.locale][key] ?? key;
	}

	toggle() {
		this.locale = this.locale === 'th' ? 'en' : 'th';
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('locale', this.locale);
		}
	}

	setLocale(locale: Locale) {
		this.locale = locale;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('locale', this.locale);
		}
	}

	get isEn(): boolean {
		return this.locale === 'en';
	}

	get isTh(): boolean {
		return this.locale === 'th';
	}
}

export const i18n = new I18nState();
