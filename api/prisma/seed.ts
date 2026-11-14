import 'dotenv/config'
import { prisma } from '../src/db'
import { computePrice, STATUSES, STATUS_LOCATION, type Mode, type Status } from '../src/lib/domain'
import { hashPassword } from '../src/lib/security'

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY)

async function main() {
  await prisma.notification.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.shipmentEvent.deleteMany()
  await prisma.shipment.deleteMany()
  await prisma.container.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()

  const mk = async (name: string, role: string, email: string | null, phone: string | null, password: string) =>
    prisma.user.create({ data: { name, role, email, phone, passwordHash: await hashPassword(password) } })

  const admin = await mk('Kader', 'ADMIN', 'admin@kadercargo.com', null, 'Admin#Kader2026')
  const gz = await mk('Mounkaila', 'AGENT_GZ', 'gz@kadercargo.com', '+8613433988698', 'Guangzhou#2026')
  const lome = await mk('Moussa', 'AGENT_LOME', 'lome@kadercargo.com', '+22890944448', 'Lome#Agence2026')
  await mk('Afi Mensah', 'CLIENT', 'afi.mensah@example.com', '+22890112233', 'Client#2026')
  await mk('Yao Kodjo', 'CLIENT', null, '+22891445566', 'Client#2026')

  const sea1 = await prisma.container.create({ data: { code: 'CT-2026-K7Q2', mode: 'SEA', state: 'CLOSED', closedAt: ago(30), departureAt: ago(28), etaAt: ago(-6) } })
  const sea2 = await prisma.container.create({ data: { code: 'CT-2026-M4TR', mode: 'SEA', state: 'CLOSED', closedAt: ago(52), departureAt: ago(50), etaAt: ago(8) } })
  const air1 = await prisma.container.create({ data: { code: 'AIR-2026-P9XD', mode: 'AIR', state: 'CLOSED', closedAt: ago(3), departureAt: ago(2), etaAt: ago(-2) } })
  const air2 = await prisma.container.create({ data: { code: 'AIR-2026-H3VW', mode: 'AIR', state: 'CLOSED', closedAt: ago(21), departureAt: ago(20), etaAt: ago(13) } })
  const open = await prisma.container.create({ data: { code: 'CT-2026-ZB8N', mode: 'SEA', state: 'OPEN', etaAt: ago(-45) } })

  type Seed = [string, string, Mode, Status, number, number, number, string, string, string | null, string | null, number]
  const rows: Seed[] = [
    ['KC-2026-889X', 'Pièces détachées moto (2 cartons)', 'SEA', 'IN_TRANSIT', 2, 64, 0.42, 'Afi Mensah', '+22890112233', 'afi.mensah@example.com', sea1.id, 34],
    ['KC-2026-7KX9QA', 'Smartphones & accessoires', 'AIR', 'IN_TRANSIT', 1, 12.5, 0.05, 'Afi Mensah', '+22890112233', 'afi.mensah@example.com', air1.id, 5],
    ['KC-2026-R2D4HN', 'Tissus wax — 30 pièces', 'AIR', 'READY', 3, 18, 0.12, 'Afi Mensah', '+22890112233', 'afi.mensah@example.com', air2.id, 22],
    ['KC-2026-PL5W8E', 'Panneaux solaires 400W ×4', 'SEA', 'DELIVERED', 4, 112, 1.1, 'Yao Kodjo', '+22891445566', null, sea2.id, 60],
    ['KC-2026-HT6M3C', 'Pièces de rechange machine à coudre', 'AIR', 'ARRIVED', 1, 14, 0.06, 'Yao Kodjo', '+22891445566', null, air2.id, 21],
    ['KC-2026-9VQ2JS', 'Cosmétiques (échantillons)', 'AIR', 'LOADING', 2, 8.2, 0.03, 'Yao Kodjo', '+22891445566', null, air1.id, 4],
    ['KC-2026-W3NZ7F', 'Meubles de salon en kit', 'SEA', 'REGISTERED', 6, 210, 2.4, 'Edem Lawson', '+22893778899', null, open.id, 2],
    ['KC-2026-B8K4TY', 'Ordinateurs portables ×3', 'AIR', 'REGISTERED', 1, 9.6, 0.04, 'Mawuli Ahadji', '+22890998877', null, null, 1],
    ['KC-2026-C6F2LU', 'Climatiseurs split ×2', 'SEA', 'REGISTERED', 2, 96, 0.9, 'Akossiwa Dogbe', '+22897112200', null, open.id, 3],
    ['KC-2026-N5G7XE', 'Chaussures (lot de 60 paires)', 'AIR', 'IN_TRANSIT', 5, 42, 0.3, 'Komla Tchala', '+22899556677', null, air1.id, 4],
  ]

  for (const [trackingId, description, mode, status, pieces, weightKg, volumeCbm, clientName, clientPhone, clientEmail, containerId, daysAgo] of rows) {
    const s = await prisma.shipment.create({
      data: {
        trackingId, description, mode, status, pieces, weightKg, volumeCbm, clientName, clientPhone, clientEmail, containerId,
        priceXof: computePrice(mode, weightKg, volumeCbm),
        createdById: gz.id,
        createdAt: ago(daysAgo),
      },
    })
    const upTo = STATUSES.indexOf(status)
    const span = mode === 'AIR' ? [0, 1, 2, 4, 5, 6] : [0, 3, 5, 38, 41, 44]
    for (let i = 0; i <= upTo; i++) {
      const st = STATUSES[i]
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: s.id,
          status: st,
          location: STATUS_LOCATION[st],
          note: i === 0 ? 'Colis réceptionné et contrôlé à l’entrepôt.' : st === 'READY' ? 'Dédouanement validé.' : null,
          createdById: i >= 3 ? lome.id : gz.id,
          createdAt: new Date(s.createdAt.getTime() + span[i] * DAY + i * 3_600_000),
        },
      })
    }
  }
  console.log(`Seed OK — users: admin=${admin.email}, gz=${gz.email}, lome=${lome.email}`)
}

main().finally(() => prisma.$disconnect())
