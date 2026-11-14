/**
 * Public contact details shown on the website.
 * TODO(Benit Cargo): replace the placeholder numbers/addresses with the real ones.
 */
export const site = {
  name: 'Benit Cargo',
  whatsapp: '22890000000', // international format, digits only
  phoneLome: '+228 90 00 00 00',
  phoneGz: '+86 138 0013 8000',
  email: 'contact@benitcargo.com',
  agencies: [
    { city: 'Guangzhou', country: 'Chine', role: 'Entrepôt de réception', address: 'District de Baiyun, Guangzhou', hours: 'Lun – Sam · 9h – 18h (heure de Chine)' },
    { city: 'Lomé', country: 'Togo', role: 'Agence de retrait', address: 'Lomé, Togo', hours: 'Lun – Sam · 8h – 18h' },
  ],
}

export const waLink = (text: string) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`
