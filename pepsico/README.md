# PepsiCo Distributor Portal – Professional UI/UX Design Specification

## Design Vision

Create a premium B2B commerce platform inspired by Shopify Admin, Salesforce Commerce Cloud, and modern SaaS dashboards while maintaining PepsiCo brand identity.

### Design Goals

* Enterprise-grade appearance
* Fast order placement workflow
* Mobile-first retailer experience
* Clean data visualization
* Professional admin operations center
* Consistent design system

---

# Brand Identity

## Primary Colors

### Pepsi Blue

```css
--primary: #005CB9;
--primary-dark: #004A94;
--primary-light: #EAF4FF;
```

### Pepsi Red

```css
--secondary: #E32934;
--secondary-light: #FFF1F2;
```

### Neutral Palette

```css
--background: #F8FAFC;
--surface: #FFFFFF;
--border: #E2E8F0;
--text-primary: #0F172A;
--text-secondary: #64748B;
```

### Success / Warning / Error

```css
--success: #22C55E;
--warning: #F59E0B;
--danger: #EF4444;
```

---

# Application Layout

## Desktop Structure

```text
┌──────────────────────────────────────────────┐
│ Top Navigation                               │
├──────────────┬───────────────────────────────┤
│ Sidebar      │ Main Content Area             │
│              │                               │
│ Dashboard    │ Widgets / Products / Orders   │
│ Products     │                               │
│ Orders       │                               │
│ Customers    │                               │
│ Analytics    │                               │
│ Settings     │                               │
└──────────────┴───────────────────────────────┘
```

---

# Modern Sidebar Navigation

## Features

* Collapsible sidebar
* Pepsi logo at top
* Icon-based navigation
* Active page indicator
* Smooth transitions

### Menu Structure

🏠 Dashboard

📦 Products

🛒 Orders

👥 Customers

📍 Delivery Addresses

📊 Analytics

🔔 Notifications

⚙ Settings

👤 Profile

🚪 Logout

---

# Dashboard Homepage

## KPI Widgets

Display at top:

```text
┌────────────┐
│ Orders     │
│ 1,245      │
│ +18%       │
└────────────┘

┌────────────┐
│ Revenue    │
│ ₹8.5L      │
│ +12%       │
└────────────┘

┌────────────┐
│ Customers  │
│ 325        │
│ +7%        │
└────────────┘

┌────────────┐
│ Products   │
│ 120        │
│ Active     │
└────────────┘
```

### Widget Features

* Icons
* Trend indicators
* Hover effects
* Real-time refresh

---

# Analytics Dashboard

## Revenue Analytics

* Revenue trend graph
* Monthly sales chart
* Top-selling products

## Customer Analytics

* Active customers
* New registrations
* Repeat order rate

## Order Analytics

* Pending orders
* Completed orders
* Cancelled orders

### Recommended Charts

* Line Charts
* Bar Charts
* Donut Charts
* Area Graphs

---

# Product Catalog Design

## Modern Product Cards

```text
┌─────────────────────┐
│ Product Image       │
│                     │
├─────────────────────┤
│ Pepsi 500ml         │
│ ₹30                 │
│                     │
│ In Stock            │
│ 250 Available       │
│                     │
│ [Add To Cart]       │
└─────────────────────┘
```

### Product Card Features

* Large image
* Hover animation
* Quick add button
* Stock badge
* Product category badge
* Quantity selector

### Stock Badges

🟢 In Stock

🟡 Low Stock

🔴 Out Of Stock

---

# Shopping Experience

## Cart Drawer

Instead of opening a new page:

* Slide-in cart panel
* Instant quantity updates
* Live subtotal calculation
* One-click checkout

---

# Order Timeline

Each order should display:

```text
Order #PEP-1045

✓ Order Placed
│
✓ Confirmed
│
✓ Packed
│
✓ Shipped
│
○ Delivered
```

### Status Colors

Placed → Blue

Packed → Orange

Shipped → Purple

Delivered → Green

Cancelled → Red

---

# Retailer Mobile Portal

## Mobile Bottom Navigation

```text
Home
Products
Orders
Cart
Profile
```

### Mobile Features

* Thumb-friendly controls
* Fast ordering
* Offline-friendly caching
* QR-based order lookup

---

# Notifications Center

Types:

* Order updates
* Product availability
* Payment confirmations
* Promotional offers

Notification badge in top navigation.

---

# Dark Mode Support

## Dark Theme Colors

```css
--background: #0F172A;
--surface: #1E293B;
--text-primary: #F8FAFC;
--text-secondary: #CBD5E1;
--border: #334155;
```

### Dark Mode Features

* Auto system detection
* Manual toggle
* Theme persistence

---

# Professional Admin Dashboard

Inspired by Shopify & Salesforce Commerce Cloud

## Admin Modules

### Product Management

* Create products
* Bulk upload products
* Category management
* Inventory updates

### Order Management

* View all orders
* Status updates
* Invoice generation
* Shipping management

### Customer Management

* Retailer approval
* Verification workflow
* Customer segmentation

### Analytics Center

* Revenue reports
* Product performance
* Customer insights
* Regional sales analysis

---

# Recommended Frontend Stack

```text
React 19
Vite
Tailwind CSS
ShadCN UI
React Query
React Hook Form
Framer Motion
Recharts
Lucide Icons
Supabase
```

---

# Premium UX Enhancements

* Skeleton loading screens
* Infinite product scrolling
* Real-time notifications
* Smart search suggestions
* Keyboard shortcuts
* Export to Excel/PDF
* Advanced filters
* Bulk actions
* Role-based dashboards
* Multi-language support

The final result should feel like a professional PepsiCo distributor platform used by thousands of retailers and distributors daily, combining enterprise functionality with a modern, intuitive user experience.
