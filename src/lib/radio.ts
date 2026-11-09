export type Contact = {
  id: string;
  callsign: string;
  frequency: string;
  mode: string;
  grid: string;
  sent: string;
  received: string;
  date: string;
};

export function bandFromFrequency(frequency: number) {
  const bands: [number, number, string][] = [[1.8, 2, '160m'], [3.5, 4, '80m'], [7, 7.3, '40m'], [10.1, 10.15, '30m'], [14, 14.35, '20m'], [18.068, 18.168, '17m'], [21, 21.45, '15m'], [24.89, 24.99, '12m'], [28, 29.7, '10m'], [50, 54, '6m'], [144, 148, '2m'], [430, 440, '70cm']];
  return bands.find(([low, high]) => frequency >= low && frequency <= high)?.[2] || '';
}

export function exportAdif(contacts: Contact[]) {
  const field = (name: string, value: string) => value ? `<${name}:${[...value].length}>${value}` : '';
  const records = contacts.map((contact) => {
    const date = new Date(contact.date).toISOString();
    return [field('CALL', contact.callsign), field('QSO_DATE', date.slice(0, 10).replace(/-/g, '')), field('TIME_ON', date.slice(11, 19).replace(/:/g, '')), field('FREQ', contact.frequency), field('BAND', bandFromFrequency(Number(contact.frequency))), field('MODE', contact.mode), field('GRIDSQUARE', contact.grid), field('RST_SENT', contact.sent), field('RST_RCVD', contact.received), '<EOR>'].filter(Boolean).join(' ');
  });
  return `MorsLab station log\n<ADIF_VER:5>3.1.4 <PROGRAMID:7>MorsLab <EOH>\n${records.join('\n')}`;
}

export function importAdif(text: string): Contact[] {
  const body = text.replace(/^[\s\S]*?<EOH>/i, '');
  const contacts: Contact[] = [];
  for (const record of body.split(/<EOR>/i)) {
    const fields: Record<string, string> = {};
    const pattern = /<([A-Z_]+):(\d+)(?::[A-Z])?>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(record))) {
      fields[match[1].toUpperCase()] = [...record.slice(pattern.lastIndex)].slice(0, Number(match[2])).join('').trim();
      pattern.lastIndex += fields[match[1].toUpperCase()].length;
    }
    if (!fields.CALL || !/^\d{8}$/.test(fields.QSO_DATE || '')) continue;
    const d = fields.QSO_DATE;
    const t = (fields.TIME_ON || '000000').padEnd(6, '0');
    const date = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`);
    if (!Number.isFinite(date.getTime())) continue;
    contacts.push({ id: crypto.randomUUID(), callsign: fields.CALL.toUpperCase(), frequency: fields.FREQ || '', mode: fields.MODE || 'CW', grid: fields.GRIDSQUARE || '', sent: fields.RST_SENT || '', received: fields.RST_RCVD || '', date: date.toISOString() });
  }
  return contacts;
}