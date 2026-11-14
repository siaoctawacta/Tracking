-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "step" TEXT,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("body", "channel", "createdAt", "error", "id", "shipmentId", "status", "to") SELECT "body", "channel", "createdAt", "error", "id", "shipmentId", "status", "to" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_shipmentId_step_idx" ON "Notification"("shipmentId", "step");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
