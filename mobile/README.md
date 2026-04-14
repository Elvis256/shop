# Shop Mobile App

React Native (Expo) Android app for the Shop e-commerce platform.

## Prerequisites

- Node.js 18+
- Android Studio with an emulator (or a physical device)
- Expo CLI: `npm install -g expo-cli`

## Setup

```bash
cd mobile
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set your backend API URL:

```
EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_IP:5000/api
```

> For emulator use `http://10.0.2.2:5000/api` (Android emulator) or `http://localhost:5000/api` (iOS simulator).

## Running

```bash
npx expo start
```

Then press `a` to open on Android emulator, or scan the QR code with Expo Go on your phone.

## Building APK

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

Or use EAS Build:

```bash
npm install -g eas-cli
eas build --platform android
```

## Project Structure

```
mobile/
├── app/                    # Screens (Expo Router file-based routing)
│   ├── (tabs)/             # Tab screens (Home, Categories, Cart, Wishlist, Account)
│   ├── auth/               # Login, Register, Forgot Password
│   ├── product/            # Product detail
│   ├── category/           # Category products
│   ├── search/             # Search
│   ├── checkout/           # Checkout flow
│   ├── orders/             # Orders list & detail
│   ├── account/            # Profile, Addresses, Change Password
│   ├── admin/              # Admin Dashboard, Products, Orders, Customers, Coupons
│   └── _layout.tsx         # Root layout
├── components/             # Shared UI components
├── constants/              # Theme (colors, spacing, fonts)
├── contexts/               # Auth & Cart context providers
└── lib/                    # API client, types, storage, hooks
```

## Features

- **Full product catalog** with categories, search, filtering, and sorting
- **Product details** with image gallery, variants, reviews & ratings
- **Shopping cart** with quantity management and server sync
- **Checkout** with address selection, M-Pesa/Airtel/MTN/Card payments via Flutterwave
- **Wishlist** with optional PIN lock
- **Order tracking** with status timeline
- **User account** management (profile, addresses, password)
- **Admin panel** (dashboard, product/order/customer/coupon management)
- **Age verification** gate
- **Dark/light theme** support
- **Secure token storage** with auto-refresh
