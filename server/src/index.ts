import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { prisma } from "./prisma";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 4000;

type CustomIdElementType =
  | "FIXED_TEXT"
  | "RANDOM_20_BITS"
  | "RANDOM_32_BITS"
  | "RANDOM_6_DIGITS"
  | "RANDOM_9_DIGITS"
  | "GUID"
  | "DATETIME"
  | "SEQUENCE";

interface CustomIdElementPayload {
  type: CustomIdElementType;
  orderIndex?: number;
  fixedText?: string | null;
  numberWidth?: number | null;
}

async function generateCustomIdForInventory(inventoryId: string): Promise<string> {
  const elements = await prisma.inventoryCustomIdElement.findMany({
    where: { inventoryId },
    orderBy: { orderIndex: "asc" },
  });

  if (elements.length === 0) {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `INV-${randomPart}`;
  }

  const itemsCount = await prisma.item.count({ where: { inventoryId } });
  const nextSequence = itemsCount + 1;

  const now = new Date();

  const parts = elements.map((element) => {
    switch (element.type as CustomIdElementType) {
      case "FIXED_TEXT":
        return element.fixedText ?? "";
      case "RANDOM_20_BITS": {
        const value = crypto.randomInt(0, 2 ** 20);
        return value.toString(16).toUpperCase();
      }
      case "RANDOM_32_BITS": {
        const value = crypto.randomInt(0, 2 ** 31);
        return value.toString(16).toUpperCase();
      }
      case "RANDOM_6_DIGITS": {
        const value = crypto.randomInt(0, 10 ** 6);
        const width = element.numberWidth ?? 6;
        return value.toString().padStart(width, "0");
      }
      case "RANDOM_9_DIGITS": {
        const value = crypto.randomInt(0, 10 ** 9);
        const width = element.numberWidth ?? 9;
        return value.toString().padStart(width, "0");
      }
      case "GUID":
        return crypto.randomUUID();
      case "DATETIME":
        return now.toISOString().replace(/[-:]/g, "").split(".")[0];
      case "SEQUENCE": {
        const width = element.numberWidth ?? 6;
        return nextSequence.toString().padStart(width, "0");
      }
      default:
        return "";
    }
  });

  return parts.join("");
}

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/api/home", async (req: Request, res: Response) => {
  try {
    const [latestInventories, popularInventories, tags] = await Promise.all([
      prisma.inventory.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          owner: { select: { name: true, email: true } },
          tags: { include: { tag: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.inventory.findMany({
        orderBy: { items: { _count: "desc" } },
        take: 5,
        include: {
          owner: { select: { name: true, email: true } },
          tags: { include: { tag: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.tag.findMany({
        take: 30,
        orderBy: { inventories: { _count: "desc" } },
        include: { _count: { select: { inventories: true } } },
      }),
    ]);

    res.json({
      latestInventories: latestInventories.map((inventory) => ({
        id: inventory.id,
        name: inventory.title,
        description: inventory.description ?? "",
        ownerName: inventory.owner.name ?? inventory.owner.email,
        itemsCount: inventory._count.items,
        tags: inventory.tags.map((t) => t.tag.name),
      })),
      popularInventories: popularInventories.map((inventory) => ({
        id: inventory.id,
        name: inventory.title,
        description: inventory.description ?? "",
        ownerName: inventory.owner.name ?? inventory.owner.email,
        itemsCount: inventory._count.items,
        tags: inventory.tags.map((t) => t.tag.name),
      })),
      tags: tags.map((tag) => ({
        id: tag.id,
        label: tag.name,
        count: tag._count.inventories,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/home", error);
    res.status(500).json({ message: "Failed to load home data" });
  }
});

app.get("/api/profile", async (req: Request, res: Response) => {
  try {
    const email = (req.query.userEmail as string) || "demo@example.com";

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        ownedInventories: {
          include: {
            tags: { include: { tag: true } },
            _count: { select: { items: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        writeAccess: {
          include: {
            inventory: {
              include: {
                tags: { include: { tag: true } },
                _count: { select: { items: true } },
                owner: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const owned = user.ownedInventories.map((inventory) => ({
      id: inventory.id,
      name: inventory.title,
      description: inventory.description ?? "",
      ownerName: user.name ?? user.email,
      itemsCount: inventory._count.items,
      tags: inventory.tags.map((t) => t.tag.name),
    }));

    const writable = user.writeAccess.map((access) => ({
      id: access.inventory.id,
      name: access.inventory.title,
      description: access.inventory.description ?? "",
      ownerName: access.inventory.owner.name ?? access.inventory.owner.email,
      itemsCount: access.inventory._count.items,
      tags: access.inventory.tags.map((t) => t.tag.name),
    }));

    res.json({ owned, writable });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/profile", error);
    res.status(500).json({ message: "Failed to load profile data" });
  }
});

app.post("/api/inventories", async (req: Request, res: Response) => {
  try {
    const { title, description, category, isPublic, ownerEmail } = req.body as {
      title: string;
      description?: string;
      category: "EQUIPMENT" | "FURNITURE" | "BOOK" | "OTHER";
      isPublic?: boolean;
      ownerEmail?: string;
    };

    const email = ownerEmail || "demo@example.com";

    if (!title || !category) {
      return res.status(400).json({ message: "Title and category are required." });
    }

    const owner = await prisma.user.findUnique({ where: { email } });
    if (!owner) {
      return res.status(404).json({ message: "Owner user not found." });
    }

    const inventory = await prisma.inventory.create({
      data: {
        title,
        description,
        category,
        isPublic: Boolean(isPublic),
        ownerId: owner.id,
      },
    });

    res.status(201).json({
      id: inventory.id,
      title: inventory.title,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/inventories", error);
    res.status(500).json({ message: "Failed to create inventory" });
  }
});

app.get("/api/inventories/:id", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: {
        tags: { include: { tag: true } },
      },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.json({
      id: inventory.id,
      title: inventory.title,
      description: inventory.description ?? "",
      category: inventory.category,
      isPublic: inventory.isPublic,
      version: inventory.version,
      tags: inventory.tags.map((t) => t.tag.name),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id", error);
    res.status(500).json({ message: "Failed to load inventory" });
  }
});

app.patch("/api/inventories/:id", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;
    const { title, description, category, isPublic, version } = req.body as {
      title?: string;
      description?: string;
      category?: "EQUIPMENT" | "FURNITURE" | "BOOK" | "OTHER";
      isPublic?: boolean;
      version: number;
    };

    const current = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: { tags: { include: { tag: true } } },
    });

    if (!current) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (version !== current.version) {
      return res.status(409).json({
        message: "Inventory has been modified by someone else.",
        current: {
          id: current.id,
          title: current.title,
          description: current.description ?? "",
          category: current.category,
          isPublic: current.isPublic,
          version: current.version,
          tags: current.tags.map((t) => t.tag.name),
        },
      });
    }

    const updated = await prisma.inventory.update({
      where: { id: inventoryId },
      data: {
        title: title ?? current.title,
        description: description ?? current.description,
        category: category ?? current.category,
        isPublic: typeof isPublic === "boolean" ? isPublic : current.isPublic,
        version: {
          increment: 1,
        },
      },
      include: { tags: { include: { tag: true } } },
    });

    res.json({
      id: updated.id,
      title: updated.title,
      description: updated.description ?? "",
      category: updated.category,
      isPublic: updated.isPublic,
      version: updated.version,
      tags: updated.tags.map((t) => t.tag.name),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /api/inventories/:id", error);
    res.status(500).json({ message: "Failed to update inventory" });
  }
});

app.get("/api/inventories/:id/items", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const items = await prisma.item.findMany({
      where: { inventoryId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    });

    res.json({
      items: items.map((item) => ({
        id: item.id,
        customId: item.customId,
        createdByName: item.createdBy.name ?? item.createdBy.email,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id/items", error);
    res.status(500).json({ message: "Failed to load items" });
  }
});

app.post("/api/inventories/:id/items", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;
    const { customId, createdByEmail } = (req.body ?? {}) as {
      customId?: string;
      createdByEmail?: string;
    };

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const email = createdByEmail || "demo@example.com";

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    try {
      const generatedId = customId ?? (await generateCustomIdForInventory(inventory.id));

      const item = await prisma.item.create({
        data: {
          inventoryId: inventory.id,
          customId: generatedId,
          createdById: user.id,
        },
        include: {
          createdBy: { select: { name: true, email: true } },
        },
      });

      res.status(201).json({
        id: item.id,
        customId: item.customId,
        createdByName: item.createdBy.name ?? item.createdBy.email,
        createdAt: item.createdAt,
      });
    } catch (err) {
      // Unique constraint violation on (inventoryId, customId)
      if (err instanceof Error && "code" in err && (err as any).code === "P2002") {
        return res.status(409).json({
          message: "Custom ID already exists in this inventory. Please choose another value.",
        });
      }
      throw err;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/inventories/:id/items", error);
    res.status(500).json({ message: "Failed to create item" });
  }
});

app.get("/api/inventories/:id/custom-id", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const elements = await prisma.inventoryCustomIdElement.findMany({
      where: { inventoryId },
      orderBy: { orderIndex: "asc" },
    });

    res.json({
      elements,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id/custom-id", error);
    res.status(500).json({ message: "Failed to load custom ID format" });
  }
});

app.put("/api/inventories/:id/custom-id", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;
    const { elements } = (req.body ?? {}) as { elements?: CustomIdElementPayload[] };

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (!elements || elements.length === 0) {
      await prisma.inventoryCustomIdElement.deleteMany({ where: { inventoryId } });

      return res.json({ elements: [] });
    }

    const sanitizedElements: CustomIdElementPayload[] = elements.map((element, index) => ({
      type: element.type,
      orderIndex: typeof element.orderIndex === "number" ? element.orderIndex : index,
      fixedText: element.fixedText ?? null,
      numberWidth: element.numberWidth ?? null,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.inventoryCustomIdElement.deleteMany({ where: { inventoryId } });

      await tx.inventoryCustomIdElement.createMany({
        data: sanitizedElements.map((element, index) => ({
          inventoryId,
          type: element.type,
          orderIndex: element.orderIndex ?? index,
          fixedText: element.fixedText,
          numberWidth: element.numberWidth,
        })),
      });
    });

    const updatedElements = await prisma.inventoryCustomIdElement.findMany({
      where: { inventoryId },
      orderBy: { orderIndex: "asc" },
    });

    res.json({
      elements: updatedElements,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /api/inventories/:id/custom-id", error);
    res.status(500).json({ message: "Failed to save custom ID format" });
  }
});

app.get("/api/inventories/:id/custom-id/preview", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const preview = await generateCustomIdForInventory(inventory.id);

    res.json({ preview });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id/custom-id/preview", error);
    res.status(500).json({ message: "Failed to generate custom ID preview" });
  }
});

app.get("/api/inventories/:id/discussion", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const posts = await prisma.discussionPost.findMany({
      where: { inventoryId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        authorId: post.author.id,
        authorName: post.author.name ?? post.author.email,
        createdAt: post.createdAt,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id/discussion", error);
    res.status(500).json({ message: "Failed to load discussion" });
  }
});

app.post("/api/inventories/:id/discussion", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;
    const { content, authorEmail } = (req.body ?? {}) as {
      content?: string;
      authorEmail?: string;
    };

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required." });
    }

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const email = authorEmail || "demo@example.com";

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const post = await prisma.discussionPost.create({
      data: {
        inventoryId: inventory.id,
        authorId: user.id,
        content: content.trim(),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      id: post.id,
      content: post.content,
      authorId: post.author.id,
      authorName: post.author.name ?? post.author.email,
      createdAt: post.createdAt,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/inventories/:id/discussion", error);
    res.status(500).json({ message: "Failed to create post" });
  }
});

app.get("/api/inventories/:id/access", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: {
        writeAccess: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    res.json({
      isPublic: inventory.isPublic,
      users: inventory.writeAccess.map((access) => ({
        id: access.user.id,
        name: access.user.name,
        email: access.user.email,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id/access", error);
    res.status(500).json({ message: "Failed to load access list" });
  }
});

app.post("/api/inventories/:id/access", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;
    const { userId, email } = (req.body ?? {}) as { userId?: string; email?: string };

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.inventoryWriteAccess.upsert({
      where: {
        inventoryId_userId: {
          inventoryId: inventory.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        inventoryId: inventory.id,
        userId: user.id,
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/inventories/:id/access", error);
    res.status(500).json({ message: "Failed to add access" });
  }
});

app.delete("/api/inventories/:id/access", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;
    const { userIds } = (req.body ?? {}) as { userIds?: string[] };

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: "userIds are required" });
    }

    await prisma.inventoryWriteAccess.deleteMany({
      where: {
        inventoryId,
        userId: { in: userIds },
      },
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /api/inventories/:id/access", error);
    res.status(500).json({ message: "Failed to remove access" });
  }
});

app.get("/api/users/search", async (req: Request, res: Response) => {
  try {
    const query = ((req.query.query as string) || "").trim();

    if (!query) {
      return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { email: "asc" },
    });

    res.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/users/search", error);
    res.status(500).json({ message: "Failed to search users" });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on http://localhost:${PORT}`);
});

