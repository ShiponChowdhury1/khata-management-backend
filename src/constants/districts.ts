/**
 * বাংলাদেশের ৬৪টি জেলার তালিকা (64 Districts of Bangladesh)
 * ফ্রন্টএন্ড বা অন্যান্য সার্ভিসে সহজে শেয়ার ও ভ্যালিডেশনের জন্য কনস্ট্যান্ট ফরম্যাটে রাখা হয়েছে।
 */
export const BANGLADESH_DISTRICTS = [
  // ঢাকা বিভাগ (Dhaka Division - 13)
  'Dhaka',
  'Gazipur',
  'Kishoreganj',
  'Manikganj',
  'Munshiganj',
  'Narayanganj',
  'Narsingdi',
  'Tangail',
  'Faridpur',
  'Gopalganj',
  'Madaripur',
  'Rajbari',
  'Shariatpur',

  // চট্টগ্রাম বিভাগ (Chattogram Division - 11)
  'Chattogram',
  "Cox's Bazar",
  'Cumilla',
  'Comilla', // বিকল্প বানান সাপোর্ট
  'Feni',
  'Brahmanbaria',
  'Chandpur',
  'Lakshmipur',
  'Noakhali',
  'Khagrachhari',
  'Rangamati',
  'Bandarban',

  // রাজশাহী বিভাগ (Rajshahi Division - 8)
  'Rajshahi',
  'Bogura',
  'Bogra', // বিকল্প বানান
  'Joypurhat',
  'Naogaon',
  'Natore',
  'Chapainawabganj',
  'Pabna',
  'Sirajganj',

  // খুলনা বিভাগ (Khulna Division - 10)
  'Khulna',
  'Bagerhat',
  'Chuadanga',
  'Jashore',
  'Jessore', // বিকল্প বানান
  'Jhenaidah',
  'Kushtia',
  'Magura',
  'Meherpur',
  'Narail',
  'Satkhira',

  // বরিশাল বিভাগ (Barishal Division - 6)
  'Barishal',
  'Barguna',
  'Bhola',
  'Jhalokathi',
  'Patuakhali',
  'Pirojpur',

  // সিলেট বিভাগ (Sylhet Division - 4)
  'Sylhet',
  'Habiganj',
  'Moulvibazar',
  'Sunamganj',

  // রংপুর বিভাগ (Rangpur Division - 8)
  'Rangpur',
  'Dinajpur',
  'Gaibandha',
  'Kurigram',
  'Lalmonirhat',
  'Nilphamari',
  'Panchagarh',
  'Thakurgaon',

  // ময়মনসিংহ বিভাগ (Mymensingh Division - 4)
  'Mymensingh',
  'Jamalpur',
  'Netrokona',
  'Sherpur',
] as const;

export type District = (typeof BANGLADESH_DISTRICTS)[number];
