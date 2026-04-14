import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useTheme } from "@/lib/hooks";
import { storage } from "@/lib/storage";
import AgeGate from "./age-gate";

function RootLayoutContent() {
  const theme = useTheme();
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);

  useEffect(() => {
    storage.isAgeVerified().then(setAgeVerified);
  }, []);

  if (ageVerified === null) return null;

  if (!ageVerified) {
    return (
      <AgeGate
        onVerified={() => {
          storage.setAgeVerified(true);
          setAgeVerified(true);
        }}
      />
    );
  }

  return (
    <>
      <StatusBar style={theme.statusBar as any} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: "Login", presentation: "modal" }} />
        <Stack.Screen name="auth/register" options={{ title: "Create Account", presentation: "modal" }} />
        <Stack.Screen name="auth/forgot-password" options={{ title: "Reset Password", presentation: "modal" }} />
        <Stack.Screen name="product/[slug]" options={{ title: "" }} />
        <Stack.Screen name="category/[slug]" options={{ title: "" }} />
        <Stack.Screen name="search/index" options={{ title: "Search" }} />
        <Stack.Screen name="checkout/index" options={{ title: "Checkout" }} />
        <Stack.Screen name="orders/index" options={{ title: "My Orders" }} />
        <Stack.Screen name="orders/[id]" options={{ title: "Order Details" }} />
        <Stack.Screen name="account/profile" options={{ title: "Edit Profile" }} />
        <Stack.Screen name="account/addresses" options={{ title: "My Addresses" }} />
        <Stack.Screen name="account/change-password" options={{ title: "Change Password" }} />
        <Stack.Screen name="admin/index" options={{ title: "Admin Dashboard" }} />
        <Stack.Screen name="admin/products" options={{ title: "Manage Products" }} />
        <Stack.Screen name="admin/orders" options={{ title: "Manage Orders" }} />
        <Stack.Screen name="admin/customers" options={{ title: "Customers" }} />
        <Stack.Screen name="admin/coupons" options={{ title: "Coupons" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <RootLayoutContent />
      </CartProvider>
    </AuthProvider>
  );
}
