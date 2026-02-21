-- CreateEnum
CREATE TYPE "PaymentProviderType" AS ENUM ('MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'WALLET');

-- CreateEnum
CREATE TYPE "MobileMoneyStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchangeRate" DECIMAL(15,6) NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PaymentProviderType" NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "merchantId" TEXT,
    "callbackUrl" TEXT,
    "currencies" TEXT[],
    "feeType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "feeValue" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "minFee" DECIMAL(10,2),
    "maxFee" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileMoneyTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "provider" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "externalRef" TEXT,
    "transactionId" TEXT,
    "status" "MobileMoneyStatus" NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MobileMoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_orderId_idx" ON "MobileMoneyTransaction"("orderId");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_externalRef_idx" ON "MobileMoneyTransaction"("externalRef");

-- AddForeignKey
ALTER TABLE "MobileMoneyTransaction" ADD CONSTRAINT "MobileMoneyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
