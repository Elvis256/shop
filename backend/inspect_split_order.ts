import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  const orderNumber = 'ORD-1781968447212-DKBDONO97';
  
  console.log(`Inspecting split order ${orderNumber}...`);
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      payments: true,
      timeline: true
    }
  });
  console.log(JSON.stringify(order, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
