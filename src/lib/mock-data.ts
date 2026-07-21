export type Grade = "Pristine" | "Excellent" | "Good";

export const gradeFactor: Record<Grade, number> = {
  Pristine: 1.0,
  Excellent: 0.85,
  Good: 0.7,
};

export type Product = {
  id: string;
  brand: string;
  title: string;
  category: string;
  originalPrice: number;
  ageYears: number;
  declaredGrade: Grade;
  confirmedGrade?: Grade;
  seller: string;
  sellerScore: number;
  image: string;
  gallery: string[];
  verified: boolean;
  inspected: boolean;
  size: string;
};

const img = (seed: string) => `https://picsum.photos/seed/resell-${seed}/600/750`;

export const products: Product[] = [
  {
    id: "p1",
    brand: "Zara",
    title: "Oversized Wool Blend Coat",
    category: "Outerwear",
    originalPrice: 12999,
    ageYears: 1,
    declaredGrade: "Excellent",
    confirmedGrade: "Excellent",
    seller: "Ananya S.",
    sellerScore: 4.8,
    image: img("coat-1"),
    gallery: [img("coat-1"), img("coat-1b"), img("coat-1c"), img("coat-1d")],
    verified: true,
    inspected: true,
    size: "M",
  },
  {
    id: "p2",
    brand: "Tommy Hilfiger",
    title: "Slim Fit Cotton Shirt",
    category: "Shirts",
    originalPrice: 4499,
    ageYears: 2,
    declaredGrade: "Pristine",
    seller: "Rohit K.",
    sellerScore: 4.6,
    image: img("shirt-2"),
    gallery: [img("shirt-2"), img("shirt-2b"), img("shirt-2c")],
    verified: true,
    inspected: false,
    size: "L",
  },
  {
    id: "p3",
    brand: "Nike",
    title: "Air Zoom Pegasus 40",
    category: "Sneakers",
    originalPrice: 10995,
    ageYears: 1,
    declaredGrade: "Excellent",
    confirmedGrade: "Good",
    seller: "Meera V.",
    sellerScore: 4.9,
    image: img("shoe-3"),
    gallery: [img("shoe-3"), img("shoe-3b"), img("shoe-3c")],
    verified: true,
    inspected: true,
    size: "UK 8",
  },
  {
    id: "p4",
    brand: "H&M",
    title: "Ribbed Knit Midi Dress",
    category: "Dresses",
    originalPrice: 2999,
    ageYears: 1,
    declaredGrade: "Excellent",
    seller: "Priya D.",
    sellerScore: 4.4,
    image: img("dress-4"),
    gallery: [img("dress-4"), img("dress-4b")],
    verified: true,
    inspected: false,
    size: "S",
  },
  {
    id: "p5",
    brand: "Levi's",
    title: "511 Slim Fit Jeans",
    category: "Jeans",
    originalPrice: 4999,
    ageYears: 2,
    declaredGrade: "Good",
    confirmedGrade: "Good",
    seller: "Aditya M.",
    sellerScore: 4.7,
    image: img("jeans-5"),
    gallery: [img("jeans-5"), img("jeans-5b")],
    verified: true,
    inspected: true,
    size: "32",
  },
  {
    id: "p6",
    brand: "Mango",
    title: "Linen Blazer",
    category: "Blazers",
    originalPrice: 7999,
    ageYears: 1,
    declaredGrade: "Pristine",
    confirmedGrade: "Pristine",
    seller: "Nisha R.",
    sellerScore: 4.9,
    image: img("blazer-6"),
    gallery: [img("blazer-6"), img("blazer-6b")],
    verified: true,
    inspected: true,
    size: "M",
  },
  {
    id: "p7",
    brand: "Adidas",
    title: "Ultraboost 22 Running",
    category: "Sneakers",
    originalPrice: 17999,
    ageYears: 1,
    declaredGrade: "Excellent",
    seller: "Karan J.",
    sellerScore: 4.5,
    image: img("shoe-7"),
    gallery: [img("shoe-7"), img("shoe-7b")],
    verified: true,
    inspected: false,
    size: "UK 9",
  },
  {
    id: "p8",
    brand: "Vero Moda",
    title: "Floral Wrap Dress",
    category: "Dresses",
    originalPrice: 3499,
    ageYears: 2,
    declaredGrade: "Good",
    confirmedGrade: "Good",
    seller: "Isha P.",
    sellerScore: 4.3,
    image: img("dress-8"),
    gallery: [img("dress-8"), img("dress-8b")],
    verified: true,
    inspected: true,
    size: "M",
  },
];

export function computePrice(originalPrice: number, ageYears: number, grade: Grade) {
  const depreciation = 1 - 0.2 * ageYears;
  const factor = gradeFactor[grade];
  const listPrice = Math.max(0, Math.round(originalPrice * depreciation * factor));
  const sellerPayout = Math.round(listPrice * 0.9);
  const commission = listPrice - sellerPayout;
  return {
    listPrice,
    sellerPayout,
    commission,
    depreciation,
    factor,
  };
}

export type EligibleOrder = {
  orderId: string;
  brand: string;
  title: string;
  category: string;
  size: string;
  originalPrice: number;
  purchaseDate: string;
  ageYears: number;
  image: string;
};

export const eligibleOrders: EligibleOrder[] = [
  {
    orderId: "o-101",
    brand: "Tommy Hilfiger",
    title: "Colour-Block Puffer Jacket",
    category: "Outerwear",
    size: "M",
    originalPrice: 14999,
    purchaseDate: "Nov 2024",
    ageYears: 1,
    image: img("order-101"),
  },
  {
    orderId: "o-102",
    brand: "Nike",
    title: "Court Vision Low Sneakers",
    category: "Sneakers",
    size: "UK 8",
    originalPrice: 6495,
    purchaseDate: "Mar 2024",
    ageYears: 2,
    image: img("order-102"),
  },
  {
    orderId: "o-103",
    brand: "Zara",
    title: "Pleated Satin Midi Skirt",
    category: "Skirts",
    size: "S",
    originalPrice: 3990,
    purchaseDate: "Aug 2025",
    ageYears: 1,
    image: img("order-103"),
  },
  {
    orderId: "o-104",
    brand: "Levi's",
    title: "Trucker Denim Jacket",
    category: "Outerwear",
    size: "L",
    originalPrice: 5499,
    purchaseDate: "Jan 2025",
    ageYears: 1,
    image: img("order-104"),
  },
  {
    orderId: "o-105",
    brand: "Roadster",
    title: "Casual Solid Cotton Shirt",
    category: "Shirts",
    size: "M",
    originalPrice: 2499,
    purchaseDate: "May 2025",
    ageYears: 1,
    image: img("order-105"),
  },
];

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
