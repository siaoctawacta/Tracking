-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "payload" TEXT,
    "userId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "roles" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "googleSub" TEXT,
    "emailVerifiedAt" DATETIME,
    "phoneVerifiedAt" DATETIME,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "signupMethod" TEXT,
    "notificationsSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt") SELECT "active", "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE INDEX "User_approvalStatus_idx" ON "User"("approvalStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "OtpCode_destination_purpose_idx" ON "OtpCode"("destination", "purpose");

-- CreateIndex
CREATE INDEX "StaffNotification_createdAt_idx" ON "StaffNotification"("createdAt");
