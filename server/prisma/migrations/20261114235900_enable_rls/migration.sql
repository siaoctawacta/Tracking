-- Supabase expose automatiquement le schéma "public" via son API REST (PostgREST)
-- avec la clé publique « anon ». On active la Row Level Security sans aucune
-- politique : les rôles anon / authenticated ne voient plus rien.
-- L'application se connecte en tant que propriétaire des tables (postgres),
-- qui contourne la RLS : son fonctionnement n'est pas modifié.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OtpCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Container" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShipmentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Photo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
