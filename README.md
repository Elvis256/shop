# Adult Store - Full Stack E-Commerce

Production-ready adult store with Next.js frontend, Express backend, PostgreSQL database, and Flutterwave payment integration for East Africa (M-Pesa, Airtel Money, MTN MoMo, Cards).

## Features

### Customer Features
- ✅ User authentication (register, login, password reset)
- ✅ Product browsing with filters and search
- ✅ Shopping cart
- ✅ Wishlist with PIN lock
- ✅ Multiple payment methods (M-Pesa, Airtel, MTN, Cards)
- ✅ Order tracking
- ✅ Product reviews
- ✅ Saved addresses
- ✅ Coupon codes
- ✅ Age verification gate
- ✅ Discreet shipping option

### Admin Features
- ✅ Dashboard with analytics
- ✅ Product management (CRUD, bulk actions, images)
- ✅ Order management (status updates, refunds)
- ✅ Customer management
- ✅ Coupon management
- ✅ Category management
- ✅ Inventory tracking
- ✅ Settings

### Security
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ Webhook verification
- ✅ Input validation (Zod)

## Project Structure

```
shop/
├── frontend/              # Next.js 14 + Tailwind CSS
│   ├── app/
│   │   ├── auth/          # Login, register, forgot password
│   │   ├── account/       # User account pages
│   │   ├── admin/         # Admin panel
│   │   ├── category/      # Product listing
│   │   ├── product/       # Product detail
│   │   ├── checkout/      # Checkout flow
│   │   ├── search/        # Search results
│   │   └── wishlist/      # User wishlist
│   ├── components/        # Reusable UI components
│   └── lib/               # API client, hooks
│
├── backend/               # Node.js + Express + Prisma
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   │   └── admin/     # Admin endpoints
│   │   ├── services/      # Flutterwave integration
│   │   ├── middleware/    # Auth, security, upload
│   │   └── lib/           # Prisma, email
│   └── prisma/            # Schema + seed
│
├── docker-compose.yml     # Container orchestration
└── .env.example           # Environment template
```

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your credentials

# Start all services
docker-compose up -d

# Seed database
docker-compose exec backend npm run db:seed
```

### Option 2: Local Development

#### Backend
```bash
cd backend
cp .env.example .env    # Edit with your credentials
npm install
npx prisma migrate dev --name init
npm run db:seed         # Seed sample data
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Admin Panel: http://localhost:3000/admin
- Health Check: http://localhost:4000/health

### Admin Login
Admin credentials are set via environment variables:
- `ADMIN_EMAIL` - Admin email address
- `ADMIN_PASSWORD` - Admin password (must be strong: 8+ chars, uppercase, lowercase, number, special char)

⚠️ **Security Note:** Never use default credentials in production. Always set strong, unique passwords.

## Environment Variables

```env
# JWT
JWT_SECRET=your-super-secret-jwt-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/adultstore

# Flutterwave
FLW_PUBLIC_KEY=FLWPUBK_TEST-xxxx
FLW_SECRET_KEY=FLWSECK_TEST-xxxx
FLW_WEBHOOK_HASH=your-verif-hash

# URLs
BASE_URL=http://localhost:3000
API_URL=http://localhost:4000

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/products` | List products |
| GET | `/api/products/:slug` | Get product |
| GET | `/api/search` | Search products |
| GET | `/api/reviews/product/:id` | Get product reviews |

### Authenticated
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get profile |
| PUT | `/api/auth/me` | Update profile |
| GET | `/api/wishlist` | Get wishlist |
| POST | `/api/wishlist` | Add to wishlist |
| GET | `/api/addresses` | Get addresses |
| POST | `/api/checkout/create` | Create order |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET/POST | `/api/admin/products` | Products CRUD |
| GET/PUT | `/api/admin/orders` | Order management |
| GET | `/api/admin/customers` | Customer list |
| GET/POST | `/api/admin/coupons` | Coupon management |

## Payment Flow

1. User adds items to cart
2. Proceeds to checkout
3. Selects payment method (M-Pesa/Airtel/MTN/Card)
4. Backend creates Flutterwave payment
5. User completes payment (mobile approval or card entry)
6. Flutterwave sends webhook confirmation
7. Order status updated to PAID
8. Confirmation email sent

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, TypeScript
- **Backend**: Node.js, Express, Prisma, TypeScript
- **Database**: PostgreSQL
- **Auth**: JWT + bcrypt
- **Payments**: Flutterwave
- **Email**: Nodemailer
- **Security**: Helmet, rate-limit
- **Containerization**: Docker

## License

Private - All rights reserved.
