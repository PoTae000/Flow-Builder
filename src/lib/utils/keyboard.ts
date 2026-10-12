// Physical key positions keep shortcuts stable when switching keyboard layouts.
const thaiLetters = 'ฟิแกำดเ้ร่าสทืนยๆพหะีอไปัผ';
const latinLetters = 'abcdefghijklmnopqrstuvwxyz';
export function shortcutCode(event: Pick<KeyboardEvent, 'code' | 'key'>): string {
 if (event.code && event.code !== 'Unidentified') return event.code;
 const key = event.key.toLowerCase();
 if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
 const index = thaiLetters.indexOf(key);
 if (key && index >= 0) return `Key${latinLetters[index].toUpperCase()}`;
 if (/^[0-9]$/.test(key)) return `Digit${key}`;
 return event.key;
}
