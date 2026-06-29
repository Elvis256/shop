import prisma from "../../lib/prisma";

export async function getParentCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          products: {
            where: { status: "ACTIVE" },
          },
        },
      },
    },
  });
}

export async function getProductsByCategory(
  categoryId: string,
  page: number,
  limit = 5
) {
  const skip = page * limit;
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: {
        categoryId,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
      },
    }),
    prisma.product.count({
      where: {
        categoryId,
        status: "ACTIVE",
      },
    }),
  ]);
  return { products, total };
}

export async function searchProducts(query: string, page: number, limit = 5) {
  const skip = page * limit;
  const where = {
    status: "ACTIVE" as const,
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
      { tags: { hasSome: [query.toLowerCase()] } },
    ],
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return { products, total };
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: { position: "asc" } },
    },
  });
}

export async function getAffiliateCode(
  userId: string | null
): Promise<string | null> {
  if (!userId) return null;
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
  });
  return affiliate && affiliate.status === "APPROVED" ? affiliate.code : null;
}
