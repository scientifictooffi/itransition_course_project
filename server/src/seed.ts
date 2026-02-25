import { prisma } from "./prisma";

async function main() {
  const demoEmail = "demo@example.com";

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "Demo User",
      role: "ADMIN",
    },
  });

  const equipmentTag = await prisma.tag.upsert({
    where: { name: "equipment" },
    update: {},
    create: { name: "equipment" },
  });

  const booksTag = await prisma.tag.upsert({
    where: { name: "books" },
    update: {},
    create: { name: "books" },
  });

  const hrTag = await prisma.tag.upsert({
    where: { name: "hr" },
    update: {},
    create: { name: "hr" },
  });

  const officeInventory = await prisma.inventory.upsert({
    where: { id: "seed-office-laptops" },
    update: {},
    create: {
      id: "seed-office-laptops",
      title: "Office laptops",
      description: "Company laptops and notebooks.",
      category: "EQUIPMENT",
      ownerId: user.id,
      tags: {
        create: [{ tagId: equipmentTag.id }],
      },
    },
  });

  const booksInventory = await prisma.inventory.upsert({
    where: { id: "seed-library-books" },
    update: {},
    create: {
      id: "seed-library-books",
      title: "Library books",
      description: "Public library collection.",
      category: "BOOK",
      ownerId: user.id,
      tags: {
        create: [{ tagId: booksTag.id }],
      },
    },
  });

  await prisma.item.createMany({
    data: [
      {
        id: "seed-item-1",
        inventoryId: officeInventory.id,
        customId: "LP-000001",
        createdById: user.id,
      },
      {
        id: "seed-item-2",
        inventoryId: officeInventory.id,
        customId: "LP-000002",
        createdById: user.id,
      },
      {
        id: "seed-item-3",
        inventoryId: booksInventory.id,
        customId: "BK-000001",
        createdById: user.id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.inventoryWriteAccess.createMany({
    data: [
      {
        inventoryId: booksInventory.id,
        userId: user.id,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.tag.upsert({
    where: { name: "documents" },
    update: {},
    create: { name: "documents" },
  });

  await prisma.tag.upsert({
    where: { name: "hr" },
    update: {},
    create: { name: "hr" },
  });
}

main()
  .then(async () => {
    // eslint-disable-next-line no-console
    console.log("Seed completed");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });

