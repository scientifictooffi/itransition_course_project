-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('EQUIPMENT', 'FURNITURE', 'BOOK', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryFieldType" AS ENUM ('SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT', 'NUMBER', 'LINK', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "CustomIdElementType" AS ENUM ('FIXED_TEXT', 'RANDOM_20_BITS', 'RANDOM_32_BITS', 'RANDOM_6_DIGITS', 'RANDOM_9_DIGITS', 'GUID', 'DATETIME', 'SEQUENCE');

-- CreateTable
CREATE TABLE "User"
(
    "id"        TEXT         NOT NULL,
    "email"     TEXT         NOT NULL,
    "name"      TEXT,
    "avatarUrl" TEXT,
    "isBlocked" BOOLEAN      NOT NULL DEFAULT false,
    "role"      "UserRole"   NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory"
(
    "id"          TEXT                NOT NULL,
    "title"       TEXT                NOT NULL,
    "description" TEXT,
    "category"    "InventoryCategory" NOT NULL,
    "imageUrl"    TEXT,
    "isPublic"    BOOLEAN             NOT NULL DEFAULT false,
    "version"     INTEGER             NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)        NOT NULL,
    "ownerId"     TEXT                NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag"
(
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTag"
(
    "inventoryId" TEXT NOT NULL,
    "tagId"       TEXT NOT NULL,

    CONSTRAINT "InventoryTag_pkey" PRIMARY KEY ("inventoryId", "tagId")
);

-- CreateTable
CREATE TABLE "InventoryWriteAccess"
(
    "inventoryId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,

    CONSTRAINT "InventoryWriteAccess_pkey" PRIMARY KEY ("inventoryId", "userId")
);

-- CreateTable
CREATE TABLE "InventoryField"
(
    "id"          TEXT                 NOT NULL,
    "inventoryId" TEXT                 NOT NULL,
    "type"        "InventoryFieldType" NOT NULL,
    "title"       TEXT                 NOT NULL,
    "description" TEXT,
    "showInTable" BOOLEAN              NOT NULL DEFAULT false,
    "orderIndex"  INTEGER              NOT NULL,

    CONSTRAINT "InventoryField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item"
(
    "id"          TEXT         NOT NULL,
    "inventoryId" TEXT         NOT NULL,
    "customId"    TEXT         NOT NULL,
    "version"     INTEGER      NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT         NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemFieldValue"
(
    "id"           TEXT NOT NULL,
    "itemId"       TEXT NOT NULL,
    "fieldId"      TEXT NOT NULL,
    "valueString"  TEXT,
    "valueNumber"  DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "valueLink"    TEXT,

    CONSTRAINT "ItemFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLike"
(
    "itemId"    TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLike_pkey" PRIMARY KEY ("itemId", "userId")
);

-- CreateTable
CREATE TABLE "DiscussionPost"
(
    "id"          TEXT         NOT NULL,
    "inventoryId" TEXT         NOT NULL,
    "authorId"    TEXT         NOT NULL,
    "content"     TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCustomIdElement"
(
    "id"          TEXT                  NOT NULL,
    "inventoryId" TEXT                  NOT NULL,
    "type"        "CustomIdElementType" NOT NULL,
    "orderIndex"  INTEGER               NOT NULL,
    "fixedText"   TEXT,
    "numberWidth" INTEGER,

    CONSTRAINT "InventoryCustomIdElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag" ("name");

-- CreateIndex
CREATE UNIQUE INDEX "Item_inventoryId_customId_key" ON "Item" ("inventoryId", "customId");

-- AddForeignKey
ALTER TABLE "Inventory"
    ADD CONSTRAINT "Inventory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTag"
    ADD CONSTRAINT "InventoryTag_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTag"
    ADD CONSTRAINT "InventoryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWriteAccess"
    ADD CONSTRAINT "InventoryWriteAccess_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWriteAccess"
    ADD CONSTRAINT "InventoryWriteAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryField"
    ADD CONSTRAINT "InventoryField_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item"
    ADD CONSTRAINT "Item_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item"
    ADD CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFieldValue"
    ADD CONSTRAINT "ItemFieldValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFieldValue"
    ADD CONSTRAINT "ItemFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "InventoryField" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLike"
    ADD CONSTRAINT "ItemLike_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLike"
    ADD CONSTRAINT "ItemLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionPost"
    ADD CONSTRAINT "DiscussionPost_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionPost"
    ADD CONSTRAINT "DiscussionPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCustomIdElement"
    ADD CONSTRAINT "InventoryCustomIdElement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
