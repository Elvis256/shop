import prisma from "../lib/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import axios from "axios";

const API_URL = "http://localhost:4000";

function generateToken(payload: { id: string; email: string; role: string; portal?: string }): string {
  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    throw new Error("JWT_SECRET not found in env");
  }
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

async function runTest() {
  console.log("🚀 Starting wishlist PIN security integration test...");

  // 1. Clean up old test users if they exist
  await prisma.wishlistItem.deleteMany({
    where: {
      user: {
        email: { in: ["test_user_a@example.com", "test_user_b@example.com"] }
      }
    }
  });

  await prisma.user.deleteMany({
    where: {
      email: { in: ["test_user_a@example.com", "test_user_b@example.com"] }
    }
  });

  // 2. Create user A and user B
  const hashedPassword = await bcrypt.hash("password123", 10);
  const userA = await prisma.user.create({
    data: {
      email: "test_user_a@example.com",
      password: hashedPassword,
      name: "Test User A",
      role: "CUSTOMER",
      emailVerified: true
    }
  });

  const userB = await prisma.user.create({
    data: {
      email: "test_user_b@example.com",
      password: hashedPassword,
      name: "Test User B",
      role: "CUSTOMER",
      emailVerified: true
    }
  });

  console.log("✅ Created test users:", { userA: userA.email, userB: userB.email });

  // 3. Pair users
  await prisma.user.update({
    where: { id: userA.id },
    data: { partnerId: userB.id }
  });

  await prisma.user.update({
    where: { id: userB.id },
    data: { partnerId: userA.id }
  });

  console.log("✅ Paired test users as couple.");

  // 4. Generate auth tokens
  const tokenA = generateToken({ id: userA.id, email: userA.email, role: userA.role, portal: "customer" });
  const tokenB = generateToken({ id: userB.id, email: userB.email, role: userB.role, portal: "customer" });

  const clientA = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "x-twa-context": "true"
    }
  });

  const clientB = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "x-twa-context": "true"
    }
  });

  // Test 1: User A gets own empty wishlist
  const resOwn = await clientA.get("/api/wishlist");
  if (resOwn.status !== 200 || !Array.isArray(resOwn.data.items)) {
    throw new Error("Test 1 failed: Could not fetch own wishlist");
  }
  console.log("✅ Test 1 Passed: User A fetched own wishlist successfully.");

  // Test 2: User A fetches User B's wishlist (no PIN set by B yet)
  const resCoupleNoPin = await clientA.get("/api/wishlist/couple");
  if (resCoupleNoPin.status !== 200 || !resCoupleNoPin.data.paired || resCoupleNoPin.data.items.length !== 0) {
    throw new Error("Test 2 failed: Could not fetch partner's wishlist");
  }
  console.log("✅ Test 2 Passed: User A fetched partner's wishlist with no PIN successfully.");

  // Test 3: User B sets a wishlist PIN "4321"
  const resSetPin = await clientB.post("/api/wishlist/set-pin", { pin: "4321" });
  if (resSetPin.status !== 200) {
    throw new Error("Test 3 failed: User B could not set wishlist PIN");
  }
  console.log("✅ Test 3 Passed: User B set wishlist PIN successfully.");

  // Test 4: User A fetches User B's wishlist (locked now)
  try {
    await clientA.get("/api/wishlist/couple");
    throw new Error("Test 4 failed: Expected 403 Forbidden for locked partner wishlist, but got 200");
  } catch (error: any) {
    if (error.response?.status !== 403 || error.response?.data?.code !== "PARTNER_PIN_REQUIRED") {
      console.error("Test 4 error details:", error.response?.status, error.response?.data);
      throw new Error(`Test 4 failed: Expected 403 with code PARTNER_PIN_REQUIRED, got status ${error.response?.status}`);
    }
  }
  console.log("✅ Test 4 Passed: Access blocked to locked partner wishlist (returned 403 PARTNER_PIN_REQUIRED).");

  // Test 5: User A verifies User B's PIN
  const resVerifyPartnerPin = await clientA.post("/api/wishlist/couple/verify-pin", { pin: "4321" });
  if (resVerifyPartnerPin.status !== 200 || !resVerifyPartnerPin.data.valid || !resVerifyPartnerPin.data.token) {
    throw new Error("Test 5 failed: User A could not verify partner PIN");
  }
  const partnerWishlistToken = resVerifyPartnerPin.data.token;
  console.log("✅ Test 5 Passed: User A successfully verified User B's PIN and received authorization token.");

  // Test 6: User A fetches User B's wishlist with the token
  const resCoupleWithPin = await clientA.get("/api/wishlist/couple", {
    headers: {
      "x-partner-wishlist-token": partnerWishlistToken,
      "x-twa-context": "true"
    }
  });
  if (resCoupleWithPin.status !== 200 || !resCoupleWithPin.data.paired || resCoupleWithPin.data.items.length !== 0) {
    throw new Error("Test 6 failed: User A could not fetch partner's wishlist after verification");
  }
  console.log("✅ Test 6 Passed: User A successfully fetched locked partner wishlist using the verified token.");

  // Test 7: User A sets a PIN "1111" for themselves and tries to access their own wishlist without token
  const resSetOwnPin = await clientA.post("/api/wishlist/set-pin", { pin: "1111" });
  if (resSetOwnPin.status !== 200) {
    throw new Error("Test 7 failed: User A could not set own wishlist PIN");
  }

  // A new client without cookies or wishlist token header
  const clientAUnverified = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "x-twa-context": "true"
    }
  });

  try {
    await clientAUnverified.get("/api/wishlist");
    throw new Error("Test 7 failed: Expected 403 Forbidden for locked own wishlist, but got 200");
  } catch (error: any) {
    if (error.response?.status !== 403 || error.response?.data?.code !== "PIN_REQUIRED") {
      throw new Error(`Test 7 failed: Expected 403 with code PIN_REQUIRED, got status ${error.response?.status}`);
    }
  }
  console.log("✅ Test 7 Passed: Access blocked to locked own wishlist (returned 403 PIN_REQUIRED).");

  // Test 8: User A accesses own wishlist with the token from set-pin
  const ownWishlistToken = resSetOwnPin.data.token;
  const resOwnWithPin = await clientAUnverified.get("/api/wishlist", {
    headers: {
      "x-wishlist-token": ownWishlistToken,
      "x-twa-context": "true"
    }
  });
  if (resOwnWithPin.status !== 200 || !Array.isArray(resOwnWithPin.data.items)) {
    throw new Error("Test 8 failed: User A could not fetch own wishlist after verification");
  }
  console.log("✅ Test 8 Passed: User A successfully fetched locked own wishlist using the verified token.");

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! The Wishlist PIN protection works flawlessly.");
}

runTest()
  .catch(err => {
    console.error("❌ TEST FAILED:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    // Cleanup test users
    await prisma.wishlistItem.deleteMany({
      where: {
        user: {
          email: { in: ["test_user_a@example.com", "test_user_b@example.com"] }
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: { in: ["test_user_a@example.com", "test_user_b@example.com"] }
      }
    });

    await prisma.$disconnect();
  });
