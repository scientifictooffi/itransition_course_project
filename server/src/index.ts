import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import { prisma } from "./prisma";
import openApiSpec from "./openapi.json";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

const PORT = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

interface AuthTokenPayload {
  userId: string;
  role: "USER" | "ADMIN";
}

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

type InventoryFieldType = "SINGLE_LINE_TEXT" | "MULTI_LINE_TEXT" | "NUMBER" | "LINK" | "BOOLEAN";

interface InventoryFieldPayload {
  id?: string;
  type: InventoryFieldType;
  title: string;
  description?: string | null;
  showInTable?: boolean;
  orderIndex?: number;
}

interface NumericFieldStats {
  fieldId: string;
  title: string;
  count: number;
  min: number;
  max: number;
  avg: number;
}

interface TextFieldValueStats {
  value: string;
  count: number;
}

interface TextFieldStats {
  fieldId: string;
  title: string;
  topValues: TextFieldValueStats[];
}

interface LikePayload {
  itemIds?: string[];
  userEmail?: string;
}

type ItemFieldValuePayload = {
  fieldId: string;
  valueString?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueLink?: string | null;
};

interface ItemUpdatePayload {
  customId?: string;
  version: number;
  fields?: ItemFieldValuePayload[];
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

function generateToken(userId: string, role: "USER" | "ADMIN"): string {
  const payload: AuthTokenPayload = { userId, role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function getCurrentUser(req: Request) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) return null;
    return user;
  } catch {
    return null;
  }
}

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = (req.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password should be at least 6 characters long." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "User with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/auth/register", error);
    res.status(500).json({ message: "Failed to register user" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body ?? {}) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/auth/login", error);
    res.status(500).json({ message: "Failed to login" });
  }
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isBlocked: user.isBlocked,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/auth/me", error);
    res.status(500).json({ message: "Failed to get current user" });
  }
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
      imageUrl: inventory.imageUrl,
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
    const { title, description, category, isPublic, version, tags, imageUrl } = req.body as {
      title?: string;
      description?: string;
      category?: "EQUIPMENT" | "FURNITURE" | "BOOK" | "OTHER";
      isPublic?: boolean;
      version: number;
      tags?: string[];
      imageUrl?: string | null;
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
          imageUrl: current.imageUrl,
          tags: current.tags.map((t) => t.tag.name),
        },
      });
    }

    const normalizedTags = Array.isArray(tags)
      ? Array.from(
          new Set(
            tags
              .map((name) => name.trim())
              .filter((name) => name.length > 0),
          ),
        )
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedInventory = await tx.inventory.update({
        where: { id: inventoryId },
        data: {
          title: title ?? current.title,
          description: description ?? current.description,
          category: category ?? current.category,
          isPublic: typeof isPublic === "boolean" ? isPublic : current.isPublic,
          imageUrl: typeof imageUrl === "string" ? imageUrl : current.imageUrl,
          version: {
            increment: 1,
          },
        },
      });

      if (normalizedTags) {
        if (normalizedTags.length === 0) {
          await tx.inventoryTag.deleteMany({
            where: { inventoryId },
          });
        } else {
          const existingTags = await tx.tag.findMany({
            where: {
              name: {
                in: normalizedTags,
              },
            },
          });

          const existingNames = new Set(existingTags.map((tag) => tag.name));
          const namesToCreate = normalizedTags.filter((name) => !existingNames.has(name));

          if (namesToCreate.length > 0) {
            await tx.tag.createMany({
              data: namesToCreate.map((name) => ({ name })),
              skipDuplicates: true,
            });
          }

          const allTags = await tx.tag.findMany({
            where: {
              name: {
                in: normalizedTags,
              },
            },
          });

          const tagIds = allTags.map((tag) => tag.id);

          await tx.inventoryTag.deleteMany({
            where: {
              inventoryId,
              tagId: {
                notIn: tagIds,
              },
            },
          });

          await tx.inventoryTag.createMany({
            data: tagIds.map((tagId) => ({
              inventoryId,
              tagId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.inventory.findUniqueOrThrow({
        where: { id: updatedInventory.id },
        include: { tags: { include: { tag: true } } },
      });
    });

    res.json({
      id: updated.id,
      title: updated.title,
      description: updated.description ?? "",
      category: updated.category,
      isPublic: updated.isPublic,
      version: updated.version,
      imageUrl: updated.imageUrl,
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

    const email = (req.query.userEmail as string | undefined) || "demo@example.com";

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const [items, userLikes] = await Promise.all([
      prisma.item.findMany({
        where: { inventoryId },
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { likes: true } },
        },
      }),
      user
        ? prisma.itemLike.findMany({
            where: {
              userId: user.id,
              item: { inventoryId },
            },
            select: { itemId: true },
          })
        : [],
    ]);

    const likedItemIds = new Set(userLikes.map((like) => like.itemId));

    res.json({
      items: items.map((item) => ({
        id: item.id,
        customId: item.customId,
        createdByName: item.createdBy.name ?? item.createdBy.email,
        createdAt: item.createdAt,
        likesCount: item._count.likes,
        likedByCurrentUser: likedItemIds.has(item.id),
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

app.get("/api/items/:id", async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        createdBy: { select: { name: true, email: true } },
        fieldValues: {
          include: {
            field: true,
          },
        },
        inventory: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({
      id: item.id,
      inventoryId: item.inventory.id,
      customId: item.customId,
      version: item.version,
      createdAt: item.createdAt,
      createdByName: item.createdBy.name ?? item.createdBy.email,
      fields: item.fieldValues.map((value) => ({
        fieldId: value.fieldId,
        title: value.field.title,
        type: value.field.type,
        description: value.field.description,
        valueString: value.valueString,
        valueNumber: value.valueNumber,
        valueBoolean: value.valueBoolean,
        valueLink: value.valueLink,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/items/:id", error);
    res.status(500).json({ message: "Failed to load item" });
  }
});

app.patch("/api/items/:id", async (req: Request, res: Response) => {
  try {
    const itemId = req.params.id;
    const { customId, version, fields }: ItemUpdatePayload = req.body ?? {};

    const current = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        inventory: {
          select: { id: true },
        },
        createdBy: {
          select: { name: true, email: true },
        },
        fieldValues: {
          include: {
            field: true,
          },
        },
      },
    });

    if (!current) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (version !== current.version) {
      return res.status(409).json({
        message: "Item has been modified by someone else.",
        current: {
          id: current.id,
          inventoryId: current.inventory.id,
          customId: current.customId,
          version: current.version,
          createdAt: current.createdAt,
          createdByName: current.createdBy.name ?? current.createdBy.email,
          fields: current.fieldValues.map((value) => ({
            fieldId: value.fieldId,
            title: value.field.title,
            type: value.field.type,
            description: value.field.description,
            valueString: value.valueString,
            valueNumber: value.valueNumber,
            valueBoolean: value.valueBoolean,
            valueLink: value.valueLink,
          })),
        },
      });
    }

    const sanitizedFields: ItemFieldValuePayload[] | null = Array.isArray(fields)
      ? fields.map((field) => ({
          fieldId: field.fieldId,
          valueString: field.valueString ?? null,
          valueNumber:
            typeof field.valueNumber === "number" && !Number.isNaN(field.valueNumber)
              ? field.valueNumber
              : null,
          valueBoolean:
            typeof field.valueBoolean === "boolean" ? field.valueBoolean : null,
          valueLink: field.valueLink ?? null,
        }))
      : null;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const updatedItem = await tx.item.update({
          where: { id: itemId },
          data: {
            customId: customId ?? current.customId,
            version: {
              increment: 1,
            },
          },
        });

        if (sanitizedFields) {
          await tx.itemFieldValue.deleteMany({
            where: { itemId },
          });

          const valuesToCreate = sanitizedFields
            .filter(
              (field) =>
                field.valueString !== null ||
                field.valueNumber !== null ||
                field.valueBoolean !== null ||
                field.valueLink !== null,
            )
            .map((field) => ({
              itemId,
              fieldId: field.fieldId,
              valueString: field.valueString,
              valueNumber: field.valueNumber,
              valueBoolean: field.valueBoolean,
              valueLink: field.valueLink,
            }));

          if (valuesToCreate.length > 0) {
            await tx.itemFieldValue.createMany({
              data: valuesToCreate,
            });
          }
        }

        return tx.item.findUniqueOrThrow({
          where: { id: updatedItem.id },
          include: {
            inventory: {
              select: { id: true },
            },
            createdBy: {
              select: { name: true, email: true },
            },
            fieldValues: {
              include: {
                field: true,
              },
            },
          },
        });
      });

      res.json({
        id: updated.id,
        inventoryId: updated.inventory.id,
        customId: updated.customId,
        version: updated.version,
        createdAt: updated.createdAt,
        createdByName: updated.createdBy.name ?? updated.createdBy.email,
        fields: updated.fieldValues.map((value) => ({
          fieldId: value.fieldId,
          title: value.field.title,
          type: value.field.type,
          description: value.field.description,
          valueString: value.valueString,
          valueNumber: value.valueNumber,
          valueBoolean: value.valueBoolean,
          valueLink: value.valueLink,
        })),
      });
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as any).code === "P2002") {
        return res.status(409).json({
          message: "Custom ID already exists in this inventory. Please choose another value.",
        });
      }
      throw err;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /api/items/:id", error);
    res.status(500).json({ message: "Failed to update item" });
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

app.get("/api/inventories/:id/fields", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const fields = await prisma.inventoryField.findMany({
      where: { inventoryId },
      orderBy: { orderIndex: "asc" },
    });

    res.json({
      fields: fields.map((field) => ({
        id: field.id,
        type: field.type,
        title: field.title,
        description: field.description,
        showInTable: field.showInTable,
        orderIndex: field.orderIndex,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id/fields", error);
    res.status(500).json({ message: "Failed to load fields" });
  }
});

app.put("/api/inventories/:id/fields", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;
    const { fields } = (req.body ?? {}) as { fields?: InventoryFieldPayload[] };

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (!fields || fields.length === 0) {
      await prisma.inventoryField.deleteMany({ where: { inventoryId } });
      return res.json({ fields: [] });
    }

    const limits: Record<InventoryFieldType, number> = {
      SINGLE_LINE_TEXT: 3,
      MULTI_LINE_TEXT: 3,
      NUMBER: 3,
      LINK: 3,
      BOOLEAN: 3,
    };

    const counters: Record<InventoryFieldType, number> = {
      SINGLE_LINE_TEXT: 0,
      MULTI_LINE_TEXT: 0,
      NUMBER: 0,
      LINK: 0,
      BOOLEAN: 0,
    };

    for (const field of fields) {
      const type = field.type;
      if (!limits[type]) {
        return res.status(400).json({ message: `Unsupported field type: ${type}` });
      }
      if (!field.title || !field.title.trim()) {
        return res.status(400).json({ message: "Field title is required for all fields." });
      }
      counters[type] += 1;
      if (counters[type] > limits[type]) {
        return res.status(400).json({
          message: `Too many fields of type ${type}. Maximum is ${limits[type]}.`,
        });
      }
    }

    const sanitized = fields.map((field, index) => ({
      inventoryId,
      type: field.type,
      title: field.title.trim(),
      description: field.description && field.description.trim().length > 0
        ? field.description.trim()
        : null,
      showInTable: Boolean(field.showInTable),
      orderIndex: typeof field.orderIndex === "number" ? field.orderIndex : index,
    }));

    await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryField.findMany({
        where: { inventoryId },
        select: { id: true },
      });

      if (existing.length > 0) {
        await tx.itemFieldValue.deleteMany({
          where: { fieldId: { in: existing.map((field) => field.id) } },
        });
        await tx.inventoryField.deleteMany({ where: { inventoryId } });
      }

      await tx.inventoryField.createMany({
        data: sanitized,
      });
    });

    const updatedFields = await prisma.inventoryField.findMany({
      where: { inventoryId },
      orderBy: { orderIndex: "asc" },
    });

    res.json({
      fields: updatedFields.map((field) => ({
        id: field.id,
        type: field.type,
        title: field.title,
        description: field.description,
        showInTable: field.showInTable,
        orderIndex: field.orderIndex,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /api/inventories/:id/fields", error);
    res.status(500).json({ message: "Failed to save fields" });
  }
});

app.get("/api/inventories/:id/stats", async (req: Request, res: Response) => {
  try {
    const inventoryId = req.params.id;

    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true },
    });

    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const [itemsCount, numericValues, textValues] = await Promise.all([
      prisma.item.count({ where: { inventoryId } }),
      prisma.itemFieldValue.findMany({
        where: {
          item: { inventoryId },
          field: { type: "NUMBER" },
          valueNumber: { not: null },
        },
        include: {
          field: true,
        },
      }),
      prisma.itemFieldValue.findMany({
        where: {
          item: { inventoryId },
          field: { type: { in: ["SINGLE_LINE_TEXT", "MULTI_LINE_TEXT"] } },
          valueString: { not: null },
        },
        include: {
          field: true,
        },
      }),
    ]);

    const numericByField = new Map<string, NumericFieldStats>();

    for (const value of numericValues) {
      const fieldId = value.fieldId;
      const fieldTitle = value.field.title;
      const num = value.valueNumber as number;

      let stats = numericByField.get(fieldId);
      if (!stats) {
        stats = {
          fieldId,
          title: fieldTitle,
          count: 0,
          min: num,
          max: num,
          avg: 0,
        };
        numericByField.set(fieldId, stats);
      }

      stats.count += 1;
      if (num < stats.min) stats.min = num;
      if (num > stats.max) stats.max = num;
      stats.avg += num;
    }

    for (const stats of numericByField.values()) {
      if (stats.count > 0) {
        stats.avg = stats.avg / stats.count;
      }
    }

    const textByField = new Map<string, { title: string; counts: Map<string, number> }>();

    for (const value of textValues) {
      const fieldId = value.fieldId;
      const fieldTitle = value.field.title;
      const text = (value.valueString ?? "").trim();
      if (!text) continue;

      let entry = textByField.get(fieldId);
      if (!entry) {
        entry = { title: fieldTitle, counts: new Map<string, number>() };
        textByField.set(fieldId, entry);
      }

      const previous = entry.counts.get(text) ?? 0;
      entry.counts.set(text, previous + 1);
    }

    const numericFields: NumericFieldStats[] = Array.from(numericByField.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );

    const textFields: TextFieldStats[] = Array.from(textByField.entries()).map(
      ([fieldId, entry]) => {
        const topValues: TextFieldValueStats[] = Array.from(entry.counts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
          .slice(0, 5);

        return {
          fieldId,
          title: entry.title,
          topValues,
        };
      },
    );

    textFields.sort((a, b) => a.title.localeCompare(b.title));

    res.json({
      itemsCount,
      numericFields,
      textFields,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/inventories/:id/stats", error);
    res.status(500).json({ message: "Failed to load statistics" });
  }
});

app.get("/api/search", async (req: Request, res: Response) => {
  try {
    const qRaw = (req.query.q as string | undefined) ?? "";
    const tagRaw = (req.query.tag as string | undefined) ?? "";

    const q = qRaw.trim();
    const tag = tagRaw.trim();

    if (!q && !tag) {
      return res.json({ inventories: [] });
    }

    const whereClauses: Parameters<typeof prisma.inventory.findMany>[0]["where"][] = [];

    if (q) {
      whereClauses.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (tag) {
      whereClauses.push({
        tags: {
          some: {
            tag: {
              name: tag,
            },
          },
        },
      });
    }

    const inventoriesRaw = await prisma.inventory.findMany({
      where:
        whereClauses.length === 0
          ? undefined
          : {
              AND: whereClauses,
            },
      include: {
        owner: { select: { name: true, email: true } },
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const inventories = inventoriesRaw.map((inventory) => ({
      id: inventory.id,
      name: inventory.title,
      description: inventory.description ?? "",
      ownerName: inventory.owner.name ?? inventory.owner.email,
      itemsCount: inventory._count.items,
      tags: inventory.tags.map((t) => t.tag.name),
    }));

    res.json({ inventories });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/search", error);
    res.status(500).json({ message: "Failed to perform search" });
  }
});

app.post("/api/items/likes", async (req: Request, res: Response) => {
  try {
    const { itemIds, userEmail }: LikePayload = req.body ?? {};

    if (!itemIds || itemIds.length === 0) {
      return res.status(400).json({ message: "itemIds are required" });
    }

    const email = userEmail || "demo@example.com";

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.itemLike.createMany({
      data: itemIds.map((itemId) => ({
        itemId,
        userId: user.id,
      })),
      skipDuplicates: true,
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/items/likes", error);
    res.status(500).json({ message: "Failed to like items" });
  }
});

app.delete("/api/items/likes", async (req: Request, res: Response) => {
  try {
    const { itemIds, userEmail }: LikePayload = req.body ?? {};

    if (!itemIds || itemIds.length === 0) {
      return res.status(400).json({ message: "itemIds are required" });
    }

    const email = userEmail || "demo@example.com";

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.itemLike.deleteMany({
      where: {
        userId: user.id,
        itemId: { in: itemIds },
      },
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /api/items/likes", error);
    res.status(500).json({ message: "Failed to unlike items" });
  }
});

app.get("/api/tags/search", async (req: Request, res: Response) => {
  try {
    const qRaw = (req.query.q as string | undefined) ?? "";
    const query = qRaw.trim();

    if (!query) {
      return res.json({ tags: [] });
    }

    const tags = await prisma.tag.findMany({
      where: {
        name: {
          startsWith: query,
          mode: "insensitive",
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 10,
    });

    res.json({
      tags: tags.map((tag) => tag.name),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/tags/search", error);
    res.status(500).json({ message: "Failed to search tags" });
  }
});

app.get("/api/admin/users", async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/admin/users", error);
    res.status(500).json({ message: "Failed to load users" });
  }
});

interface AdminUsersPayload {
  userIds?: string[];
}

app.post("/api/admin/users/block", async (req: Request, res: Response) => {
  try {
    const { userIds }: AdminUsersPayload = req.body ?? {};

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: "userIds are required" });
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { isBlocked: true },
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/admin/users/block", error);
    res.status(500).json({ message: "Failed to block users" });
  }
});

app.post("/api/admin/users/unblock", async (req: Request, res: Response) => {
  try {
    const { userIds }: AdminUsersPayload = req.body ?? {};

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: "userIds are required" });
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { isBlocked: false },
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/admin/users/unblock", error);
    res.status(500).json({ message: "Failed to unblock users" });
  }
});

app.post("/api/admin/users/make-admin", async (req: Request, res: Response) => {
  try {
    const { userIds }: AdminUsersPayload = req.body ?? {};

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: "userIds are required" });
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { role: "ADMIN" },
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/admin/users/make-admin", error);
    res.status(500).json({ message: "Failed to grant admin role" });
  }
});

app.post("/api/admin/users/remove-admin", async (req: Request, res: Response) => {
  try {
    const { userIds }: AdminUsersPayload = req.body ?? {};

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: "userIds are required" });
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { role: "USER" },
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/admin/users/remove-admin", error);
    res.status(500).json({ message: "Failed to revoke admin role" });
  }
});

app.delete("/api/admin/users", async (req: Request, res: Response) => {
  try {
    const { userIds }: AdminUsersPayload = req.body ?? {};

    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ message: "userIds are required" });
    }

    await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
      },
    });

    res.status(204).send();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /api/admin/users", error);
    res.status(500).json({ message: "Failed to delete users" });
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

