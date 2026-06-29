import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load backend .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Querying all CheckoutAttempt rows...');
  const attempts = await prisma.checkoutAttempt.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      status: true,
      failureCode: true,
      failureReason: true,
      orderId: true
    }
  });
  console.log(attempts);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
