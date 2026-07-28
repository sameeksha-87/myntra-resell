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

const imageMap: Record<string, string> = {
  // Zara Oversized Wool Blend Coat
  "coat-1": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=600&h=750",
  "coat-1b": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=600&h=750",
  "coat-1c": "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?auto=format&fit=crop&q=80&w=600&h=750",
  "coat-1d": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600&h=750",

  // Tommy Hilfiger Slim Fit Cotton Shirt
  "shirt-2": "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&q=80&w=600&h=750",
  "shirt-2b": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600&h=750",
  "shirt-2c": "https://images.unsplash.com/photo-1621072156002-e2fcc103e869?auto=format&fit=crop&q=80&w=600&h=750",

  // Nike Air Zoom Pegasus 40
  "shoe-3": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600&h=750",
  "shoe-3b": "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&q=80&w=600&h=750",
  "shoe-3c": "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&q=80&w=600&h=750",

  // H&M Ribbed Knit Midi Dress
  "dress-4": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600&h=750",
  "dress-4b": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=600&h=750",

  // Levi's 511 Slim Fit Jeans
  "jeans-5": "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=600&h=750",
  "jeans-5b": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=600&h=750",

  // Mango Linen Blazer
  "blazer-6": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600&h=750",
  "blazer-6b": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=600&h=750",

  // Adidas Ultraboost 22 Running
  "shoe-7": "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?auto=format&fit=crop&q=80&w=600&h=750",
  "shoe-7b": "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&q=80&w=600&h=750",

  // Vero Moda Floral Wrap Dress
  "dress-8": "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=600&h=750",
  "dress-8b": "https://images.unsplash.com/photo-1518049368264-734d3ad45e2a?auto=format&fit=crop&q=80&w=600&h=750",

  // Order Items
  "order-101": "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&q=80&w=600&h=750",
  "order-102": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=600&h=750",
  "order-103": "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=600&h=750",
  "order-104": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&q=80&w=600&h=750",
  "order-105": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600&h=750"
};

const img = (seed: string) => {
  return imageMap[seed] || `https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600&h=750`;
};

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
