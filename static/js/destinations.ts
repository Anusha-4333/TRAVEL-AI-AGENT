interface Destination {
  id: string;
  name: string;
  location: string;
  rating: number;
  image: string;
  imageAlt: string;
  description: string;
  bestTime: string;
  attractions: string[];
  budget: string;
  duration: string;
}

const destinations: Destination[] = [
  {
    id: 'manali',
    name: 'Manali',
    location: 'Himachal Pradesh, India',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1516569425899-67b4a1a0a24a?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Snow mountains and Himalayan landscape',
    description:
      'Manali is a mountain resort town nestled in the Himalayas, known for snow-capped peaks, lush pine forests, rivers, and adventure activities.',
    bestTime: 'October to February',
    attractions: ['Rohtang Pass', 'Solang Valley', 'Hadimba Temple', 'Old Manali Market'],
    budget: '₹35,000 – ₹55,000',
    duration: '4–6 Days',
  },
  {
    id: 'maldives',
    name: 'Maldives',
    location: 'Indian Ocean',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Turquoise water and beach villas in the Maldives',
    description:
      'The Maldives offers stunning overwater villas, pristine beaches, crystal-clear lagoons, and serene island escapes for romantic and luxury stays.',
    bestTime: 'November to April',
    attractions: ['Water villa stay', 'Snorkeling with manta rays', 'Sunset dolphin cruise', 'Private island dining'],
    budget: '₹1,20,000 – ₹2,50,000',
    duration: '5–7 Days',
  },
  {
    id: 'paris',
    name: 'Paris',
    location: 'France',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1526481280692-1a5f40f4b6d5?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Eiffel Tower and Paris city skyline',
    description:
      'Paris is famous for the Eiffel Tower, world-class museums, romantic boulevards, luxury shopping, and iconic historic architecture.',
    bestTime: 'April to June, September to October',
    attractions: ['Eiffel Tower', 'Louvre Museum', 'Arc de Triomphe', 'Seine River Cruise'],
    budget: '₹80,000 – ₹1,50,000',
    duration: '4–6 Days',
  },
  {
    id: 'bali',
    name: 'Bali',
    location: 'Indonesia',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1502920917128-1aa500764ce7?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Bali temple, rice terraces, and tropical beach',
    description:
      'Bali is a lush Indonesian island with temples, rice terraces, volcanic hills, vibrant beaches, and a spiritual creative culture.',
    bestTime: 'April to June, September to October',
    attractions: ['Ubud Rice Terraces', 'Tanah Lot Temple', 'Kuta Beach', 'Sacred Monkey Forest'],
    budget: '₹45,000 – ₹85,000',
    duration: '5–7 Days',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    location: 'UAE',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Burj Khalifa and Dubai modern skyline',
    description:
      'Dubai blends futuristic skyscrapers, luxury shopping, desert adventures, and glamorous nightlife around the Burj Khalifa skyline.',
    bestTime: 'November to March',
    attractions: ['Burj Khalifa', 'The Dubai Mall', 'Desert safari', 'Palm Jumeirah'],
    budget: '₹60,000 – ₹1,20,000',
    duration: '4–5 Days',
  },
];

;(window as any).travelDestinations = destinations;
