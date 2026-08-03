# LUXE — Premium E-Commerce + ERP System

A full-stack e-commerce storefront and ERP management system for a premium vape & smoking company. Built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

## Features

### Storefront
- Product catalog with categories, brands, and search
- Product details with reviews and ratings
- Shopping cart and wishlist
- Customer authentication (signup/login)
- Checkout and order tracking
- Blog, store locator, careers, FAQ

### Admin / ERP Dashboard
- Dashboard with sales analytics
- Product, category, and brand management
- Order management with returns and refunds
- Inventory management with stock transfers and adjustments
- Branch and warehouse management
- Supplier and purchase order management
- Employee management with role-based access control (RBAC)
- Customer management
- Financial reports and business intelligence
- Audit logs and notifications

### Authentication
- **Customer authentication:** Self-service signup and login at `/signin` and `/signup`
- **Employee authentication:** Separate staff login at `/admin/login` — no public registration
- **RBAC:** Role-based permissions with 11 hierarchy levels (super_admin through customer_support)
- First user is auto-promoted to super_admin for initial setup

## Stack

- **Frontend:** React 18, TypeScript, Vite, React Router 7, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, RLS policies, Edge Functions)
- **Icons:** lucide-react

## Getting started

```bash
npm install
npm run dev
```

## Available scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint
- `npm run typecheck` — run the TypeScript compiler with no emit

## Project structure

```
src/
  components/{admin,auth,storefront,ui}/   UI components by domain
  context/                                 React context providers (auth, cart, wishlist, toast)
  hooks/                                   Data-fetching hooks
  lib/                                     Supabase client, auth helpers, utilities
  pages/{admin,storefront}/                Route-level pages
  types/                                   Shared TypeScript types
supabase/
  migrations/                              Database schema and policies
  functions/                               Edge functions
```
