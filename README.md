# 👕 ReSell by Myntra

> An AI-powered circular fashion marketplace that enables users to seamlessly resell verified Myntra purchases while promoting sustainable fashion.

---

## 🚀 Overview

ReSell by Myntra transforms post-purchase fashion into a circular economy.

Instead of letting clothes remain unused, users can instantly list previously purchased Myntra products for resale. By leveraging purchase history, AI-powered verification, and smart pricing, ReSell creates a trusted and frictionless resale experience entirely within the Myntra ecosystem.

---

## 🎯 Problem Statement

Millions of garments purchased online remain unused after only a few wears.

Existing resale platforms suffer from:

- Manual listing process
- Lack of purchase verification
- Pricing uncertainty
- Trust issues between buyers and sellers
- Fragmented user experience

As a result, users hesitate to resell while valuable products remain idle.

---

## 💡 Our Solution

**AI-powered resale marketplace** built into Myntra

Key innovations include:

- 📦 Closet Sync from purchase history
- 🤖 AI-powered authenticity verification
- 💰 Smart resale price prediction
- 📸 Automatic listing generation
- 💳 Myntra Wallet integration
- 🌱 Circular fashion ecosystem

---

## ✨ Features

### 👕 Closet Sync

Automatically imports eligible Myntra purchases for resale.

---

### 🤖 AI Verification Pipeline

Our AI pipeline analyses uploaded product images using:

- Background Removal
- YOLO Object Detection
- OCR
- DINO Feature Matching

This verifies:

- Correct product
- Brand consistency
- Visual similarity
- Image quality

---

### 💰 Smart Pricing

Predicts a fair resale price using:

- Original purchase price
- Condition
- Age of purchase

---

### 📝 One-Click Listing

Automatically generates:

- Product title
- Description
- Images
- Suggested price

Reducing listing time from minutes to seconds.

---

### 💳 Wallet Integration

After every successful resale:

- Seller receives Myntra Wallet credits
- Credits can be used for future purchases
- Creates a closed-loop shopping ecosystem

---

## 🏗️ System Architecture

```
User
   │
   ▼
Closet Sync
   │
   ▼
AI Verification Pipeline
   │
   ├── Background Removal
   ├── YOLO Detection
   ├── OCR
   └── DINO Similarity
   │
   ▼
Smart Pricing
   │
   ▼
Verified Listing
   │
   ▼
Myntra Marketplace
```

---

## 🛠️ Tech Stack

### Frontend

- React.js
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- Python

### AI / ML

- YOLO
- OCR
- DINO
- OpenCV

### Database

- PostgreSQL

---

## 📊 Business Model

Revenue is generated through:

- **10% commission** on every successful resale
- Increased customer retention through Myntra Wallet credits
- Higher Customer Lifetime Value (CLV)

---

## 🌍 Market Opportunity

- 🌎 **$393B** Global second-hand apparel market by 2030
- 📈 **70%+** market growth driven by Gen Z & Millennials
- ♻ Growing adoption of circular fashion

**Source:** GlobalData via ThredUp 2026 Resale Report.

---

## 🎯 Impact

### For Users

- Faster resale
- Trusted listings
- Better pricing
- Sustainable shopping

### For Myntra

- New revenue stream
- Increased customer retention
- Closed-loop commerce
- Stronger circular fashion ecosystem

---

## 🔮 Future Roadmap

### Phase 1

Dynamic AI Pricing

### Phase 2

Fabric & Quality Intelligence

### Phase 3

AI Style Recommendations

### Phase 4

Cross-Brand Circular Marketplace

---

## 📸 Demo Workflow

1. Login
2. Closet Sync imports previous purchases
3. Select an item
4. AI verifies uploaded images
5. Smart pricing recommends resale value
6. Listing is published
7. Product is sold
8. Seller receives Myntra Wallet credits

---

## 👥 Team

Built as part of the **Myntra Hackathon**.

---
