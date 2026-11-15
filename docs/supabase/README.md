# Base de données Supabase

## Les tables se créent toutes seules

Les tables sont créées par les **migrations Prisma** (`server/prisma/migrations/`). Elles sont appliquées automatiquement pendant le build de chaque déploiement de **production** sur Vercel, à condition que `DIRECT_URL` (chaîne *Session pooler*) soit définie dans les variables d'environnement *Production*.

Après le premier déploiement, **Supabase → Table Editor** doit afficher ces 11 tables :

| Table | Contenu |
|---|---|
| `User` | Comptes : clients et personnel (rôle, téléphone, e-mail, Google, validation par l'admin) |
| `RefreshToken` | Sessions de connexion (jetons de 7 jours, stockés sous forme d'empreinte) |
| `OtpCode` | Codes de vérification WhatsApp / e-mail (empreinte, expiration 10 min) |
| `StaffNotification` | Notifications de l'équipe (nouveau compte, conteneur arrivé…) |
| `Container` | Conteneurs maritimes |
| `Shipment` | Colis (code de suivi, client, poids, montant, statut) |
| `ShipmentEvent` | Étapes du suivi de chaque colis |
| `Photo` | Photos de contrôle qualité (le fichier est dans le bucket Storage `photos`) |
| `Notification` | Historique des alertes WhatsApp envoyées aux clients |
| `RateLimit` | Compteurs anti-abus (tentatives de connexion, OTP, suivi public) |
| `_prisma_migrations` | Migrations déjà appliquées (gérée par Prisma, ne pas modifier) |

La **Row Level Security** est activée sur toutes les tables, sans politique. Supabase affiche donc « RLS enabled » et aucune règle : c'est voulu. L'API REST publique de Supabase (clé `anon`) ne voit rien, et l'application, qui se connecte en tant que propriétaire des tables, fonctionne normalement. **N'ajoutez pas de politique et ne désactivez pas la RLS.**

## Secours : créer les tables à la main

À utiliser uniquement si le build Vercel n'a pas pu appliquer les migrations, et seulement sur une **base vide** :

1. Supabase → **SQL Editor** → **New query**.
2. Collez le contenu de [`schema.sql`](schema.sql) → **Run**.

Le script enregistre aussi les migrations dans `_prisma_migrations` : les déploiements suivants ne les rejoueront pas et appliqueront seulement les nouvelles.

Ce fichier est généré : après une nouvelle migration, régénérez-le avec `node server/scripts/supabase-sql.mjs`.

## Ensuite

Créez le premier administrateur depuis un poste (aucune donnée de démo) :

```bash
npm --prefix server ci
```

```bash
printf 'Chaîne Session pooler : '; read -rs DATABASE_URL; echo; export DATABASE_URL
```

```bash
npm --prefix server run create-admin -- --name "Kader" --email admin@kadercargo.com
```

Le script affiche la base visée (`…pooler.supabase.com…`) et demande confirmation avant d'écrire. S'il indique « base locale », `DATABASE_URL` n'est pas définie : répondez `N`.

Ne lancez **jamais** `npm run setup` ni `npm --prefix server run db:seed` sur la base de production : ces commandes effacent les données.
