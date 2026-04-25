// Mock offline-store data — Bengaluru area.
// Replace with API response shape `storesAPI.list()` when backend ships.
//
// Coordinates are real lat/lng around Koramangala / Indiranagar / Whitefield /
// HSR / Marathahalli — gives realistic clustering on the map.

export type StoreCategory =
  | 'Fashion'
  | 'Electronics'
  | 'Grocery'
  | 'Food & Cafe'
  | 'Health'
  | 'Jewellery'
  | 'Sports'
  | 'Beauty';

export type Store = {
  id: string;
  name: string;
  shortName: string;          // shown on map pill
  category: StoreCategory;
  rating: number;
  reviews: number;            // count
  distanceKm: number;
  opensAt: string;            // "9:30 AM"
  address: string;
  isOpen: boolean;
  isHottest?: boolean;
  coins: number;              // cashback coins
  cashbackPercent: number;    // shown on map marker variant
  lat: number;
  lng: number;
  imageUrl?: string;
};

export const BENGALURU_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
};

export const MOCK_STORES: Store[] = [
  {
    id: 's1',
    name: 'Croma Electronics',
    shortName: 'Croma',
    category: 'Electronics',
    rating: 4.4,
    reviews: 211,
    distanceKm: 0.3,
    opensAt: '10:30 AM',
    address: 'Shop No. 12, Orion Mall, Rajajinagar',
    isOpen: true,
    coins: 65,
    cashbackPercent: 8,
    lat: 12.9921,
    lng: 77.5547,
  },
  {
    id: 's2',
    name: 'Apollo Pharmacy',
    shortName: 'Apollo',
    category: 'Health',
    rating: 4.2,
    reviews: 87,
    distanceKm: 0.3,
    opensAt: '8:30 AM',
    address: 'Near Manhi Hall, Hebbavevera, Bengaluru',
    isOpen: true,
    coins: 35,
    cashbackPercent: 5,
    lat: 12.9650,
    lng: 77.6260,
  },
  {
    id: 's3',
    name: 'Lifestyle Mega Store',
    shortName: 'Lifestyle',
    category: 'Fashion',
    rating: 4.6,
    reviews: 1240,
    distanceKm: 0.8,
    opensAt: '10:00 AM',
    address: 'Ground Floor, Phoenix MarketCity, Whitefield',
    isOpen: true,
    isHottest: true,
    coins: 85,
    cashbackPercent: 8,
    lat: 12.9970,
    lng: 77.6960,
  },
  {
    id: 's4',
    name: "Nature's Basket",
    shortName: "Nat's Basket",
    category: 'Grocery',
    rating: 4.7,
    reviews: 342,
    distanceKm: 1.1,
    opensAt: '8:00 AM',
    address: '101 Koramangala Road, 5th Block, Bengaluru',
    isOpen: true,
    coins: 45,
    cashbackPercent: 6,
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    id: 's5',
    name: 'Nike Factory Store',
    shortName: 'Nike',
    category: 'Sports',
    rating: 4.0,
    reviews: 263,
    distanceKm: 1.2,
    opensAt: '11:00 AM',
    address: 'Block 1, Forum Shantiniketan Mall, Marathahalli',
    isOpen: false,
    coins: 75,
    cashbackPercent: 7,
    lat: 12.9591,
    lng: 77.6974,
  },
  {
    id: 's6',
    name: 'Nykaa Beauty Studio',
    shortName: 'Nykaa',
    category: 'Beauty',
    rating: 4.3,
    reviews: 198,
    distanceKm: 1.3,
    opensAt: '10:30 AM',
    address: '46 Bangalore Habitat, Residency Rd, Richmond Town',
    isOpen: false,
    coins: 95,
    cashbackPercent: 9,
    lat: 12.9698,
    lng: 77.5950,
  },
  {
    id: 's7',
    name: 'Tanishq Jewellers',
    shortName: 'Tanishq',
    category: 'Jewellery',
    rating: 4.8,
    reviews: 891,
    distanceKm: 1.6,
    opensAt: '10:00 AM',
    address: '40, Main Road, Sadashiv Nagar, Bengaluru',
    isOpen: true,
    coins: 25,
    cashbackPercent: 2,
    lat: 13.0067,
    lng: 77.5825,
  },
  {
    id: 's8',
    name: 'Third Wave Coffee',
    shortName: 'Third Wave',
    category: 'Food & Cafe',
    rating: 4.5,
    reviews: 670,
    distanceKm: 2.4,
    opensAt: '7:30 AM',
    address: '12, Indiranagar 100ft Road, Bengaluru',
    isOpen: true,
    coins: 55,
    cashbackPercent: 5,
    lat: 12.9716,
    lng: 77.6412,
  },
];

export const STORE_CATEGORIES: StoreCategory[] = [
  'Fashion',
  'Electronics',
  'Grocery',
  'Food & Cafe',
  'Health',
  'Jewellery',
  'Sports',
  'Beauty',
];
