/** Public business information (source: Kader Cargo business card). */
export interface Contact { name: string; phone: string }

export const site = {
  name: 'Kader Cargo',
  tagline: 'Express Air Cargo Guangzhou → Lomé',
  /** Main WhatsApp line (Lomé — Moussa), international digits only. */
  whatsapp: '22890944448',
  whatsappDisplay: '+228 90 94 44 48',
  lome: {
    city: 'Lomé',
    country: 'Togo',
    role: 'Agence de retrait',
    address: 'Lomé, Togo',
    contacts: [
      { name: 'Moussa', phone: '+228 90 94 44 48' },
      { name: 'Salaman', phone: '+228 93 68 63 96' },
      { name: 'Moctar', phone: '+228 91 13 73 17' },
    ] as Contact[],
  },
  guangzhou: {
    city: 'Guangzhou',
    country: 'Chine',
    role: 'Entrepôt de réception',
    address: '201 Huanshi Zhong Lu, local 103 (à côté de l’hôtel Hengfulai), district de Yuexiu, Guangzhou',
    /** To hand to suppliers / drivers in China. */
    addressZh: '广州市越秀区环市中路201号亨富涞酒店旁边103档',
    contacts: [
      { name: 'Kader', phone: '+86 137 2544 5017' },
      { name: 'Kader', phone: '+86 152 0205 9957' },
      { name: 'Kader', phone: '+86 135 0307 1047' },
      { name: 'Mounkaila', phone: '+86 134 3398 8698' },
      { name: 'Mounkaila', phone: '+86 137 9816 4151' },
    ] as Contact[],
  },
  /** Door-to-door destinations from Guangzhou. */
  destinations: [
    { city: 'Lomé', country: 'Togo', code: 'TG', main: true },
    { city: 'Accra', country: 'Ghana', code: 'GH' },
    { city: 'Abidjan', country: 'Côte d’Ivoire', code: 'CI' },
    { city: 'Cotonou', country: 'Bénin', code: 'BJ' },
    { city: 'Niamey', country: 'Niger', code: 'NE' },
  ],
}

export const digits = (phone: string) => phone.replace(/\D/g, '')
export const telLink = (phone: string) => `tel:+${digits(phone)}`
export const waLink = (text: string, phone = site.whatsapp) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`

/** Groups a contact list by person: [{ name, phones: [...] }]. */
export function byPerson(list: Contact[]) {
  const map = new Map<string, string[]>()
  for (const c of list) map.set(c.name, [...(map.get(c.name) ?? []), c.phone])
  return [...map].map(([name, phones]) => ({ name, phones }))
}
