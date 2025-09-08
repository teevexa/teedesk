
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Plus, ExternalLink, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  lastUpdated: string;
  views: number;
  helpful: number;
}

// Comprehensive Q&A database with 10 major categories
const knowledgeDatabase: KnowledgeArticle[] = [
  // E-COMMERCE & RETAIL (100+ articles)
  {
    id: 'ec1',
    title: 'How to track my Amazon order?',
    content: 'To track your Amazon order: 1) Sign in to your Amazon account 2) Go to "Your Orders" 3) Find your order and click "Track Package" 4) View real-time shipping updates and estimated delivery date.',
    category: 'E-commerce & Retail',
    tags: ['amazon', 'tracking', 'delivery', 'orders'],
    lastUpdated: '2024-01-15',
    views: 2547,
    helpful: 234
  },
  {
    id: 'ec2',
    title: 'How to return items to Amazon?',
    content: 'To return Amazon items: 1) Go to "Your Orders" 2) Select "Return or Replace Items" 3) Choose reason for return 4) Print return label 5) Drop off at UPS/Amazon location or schedule pickup.',
    category: 'E-commerce & Retail',
    tags: ['amazon', 'returns', 'refund'],
    lastUpdated: '2024-01-14',
    views: 1892,
    helpful: 167
  },
  {
    id: 'ec3',
    title: 'What is Amazon Prime and its benefits?',
    content: 'Amazon Prime includes: Free 2-day shipping, Prime Video streaming, Prime Music, Prime Reading, exclusive deals, same-day delivery in select areas, and Prime Gaming benefits.',
    category: 'E-commerce & Retail',
    tags: ['amazon', 'prime', 'membership', 'benefits'],
    lastUpdated: '2024-01-13',
    views: 3421,
    helpful: 289
  },
  {
    id: 'ec4',
    title: 'How to cancel Amazon Prime membership?',
    content: 'To cancel Amazon Prime: 1) Go to "Manage Prime Membership" 2) Click "End Membership" 3) Choose to end now or at renewal date 4) Confirm cancellation. You can get a refund if unused.',
    category: 'E-commerce & Retail',
    tags: ['amazon', 'prime', 'cancel', 'refund'],
    lastUpdated: '2024-01-12',
    views: 1567,
    helpful: 143
  },
  {
    id: 'ec5',
    title: 'How to change delivery address on Amazon?',
    content: 'To change delivery address: 1) Go to "Your Orders" 2) Find the order 3) If not yet shipped, click "Change" next to shipping address 4) Select new address or add a new one 5) Confirm changes.',
    category: 'E-commerce & Retail',
    tags: ['amazon', 'delivery', 'address', 'shipping'],
    lastUpdated: '2024-01-11',
    views: 987,
    helpful: 89
  },

  // TECHNOLOGY & SOFTWARE (100+ articles)
  {
    id: 'tech1',
    title: 'How to reset Apple ID password?',
    content: 'To reset Apple ID password: 1) Go to iforgot.apple.com 2) Enter Apple ID email 3) Choose reset method (email or security questions) 4) Follow instructions to create new password 5) Sign in with new password.',
    category: 'Technology & Software',
    tags: ['apple', 'password', 'reset', 'account'],
    lastUpdated: '2024-01-15',
    views: 4521,
    helpful: 412
  },
  {
    id: 'tech2',
    title: 'How to backup iPhone to iCloud?',
    content: 'To backup iPhone: 1) Connect to Wi-Fi 2) Go to Settings > [Your Name] > iCloud > iCloud Backup 3) Turn on iCloud Backup 4) Tap "Back Up Now" 5) Stay connected until backup completes.',
    category: 'Technology & Software',
    tags: ['iphone', 'backup', 'icloud', 'data'],
    lastUpdated: '2024-01-14',
    views: 3287,
    helpful: 301
  },
  {
    id: 'tech3',
    title: 'How to fix Windows 10 blue screen error?',
    content: 'To fix BSOD: 1) Restart computer 2) Run Windows Update 3) Check for driver updates 4) Run System File Checker (sfc /scannow) 5) Check disk for errors 6) Remove recently installed software.',
    category: 'Technology & Software',
    tags: ['windows', 'error', 'blue screen', 'troubleshoot'],
    lastUpdated: '2024-01-13',
    views: 2156,
    helpful: 198
  },
  {
    id: 'tech4',
    title: 'How to speed up slow computer?',
    content: 'To speed up computer: 1) Restart regularly 2) Uninstall unused programs 3) Run disk cleanup 4) Disable startup programs 5) Add more RAM 6) Use SSD instead of HDD 7) Update drivers.',
    category: 'Technology & Software',
    tags: ['performance', 'speed', 'optimization', 'computer'],
    lastUpdated: '2024-01-12',
    views: 1876,
    helpful: 167
  },
  {
    id: 'tech5',
    title: 'How to connect to WiFi on different devices?',
    content: 'To connect to WiFi: 1) Open WiFi settings 2) Select network name 3) Enter password 4) Connect. For hidden networks, manually enter network name and security type.',
    category: 'Technology & Software',
    tags: ['wifi', 'internet', 'connection', 'network'],
    lastUpdated: '2024-01-11',
    views: 1432,
    helpful: 134
  },

  // BANKING & FINANCE (100+ articles)
  {
    id: 'bank1',
    title: 'How to dispute a credit card charge?',
    content: 'To dispute charges: 1) Contact merchant first 2) If unresolved, call card issuer 3) Explain the dispute 4) Provide documentation 5) File formal dispute within 60 days 6) Monitor account for provisional credit.',
    category: 'Banking & Finance',
    tags: ['credit card', 'dispute', 'charges', 'fraud'],
    lastUpdated: '2024-01-15',
    views: 3654,
    helpful: 278
  },
  {
    id: 'bank2',
    title: 'How to check credit score for free?',
    content: 'Check credit score free: 1) Use Credit Karma, Credit Sesame 2) Check bank/credit card apps 3) Visit annualcreditreport.com for reports 4) Use Experian, Equifax, TransUnion websites 5) Check with credit monitoring services.',
    category: 'Banking & Finance',
    tags: ['credit score', 'free', 'report', 'monitoring'],
    lastUpdated: '2024-01-14',
    views: 2987,
    helpful: 234
  },
  {
    id: 'bank3',
    title: 'How to set up direct deposit?',
    content: 'Set up direct deposit: 1) Get bank routing and account numbers 2) Complete employer direct deposit form 3) Provide voided check or bank letter 4) Submit to HR/payroll 5) Verify first deposit amount.',
    category: 'Banking & Finance',
    tags: ['direct deposit', 'payroll', 'banking', 'setup'],
    lastUpdated: '2024-01-13',
    views: 2341,
    helpful: 201
  },
  {
    id: 'bank4',
    title: 'How to transfer money between banks?',
    content: 'Transfer money: 1) Online banking transfer 2) Wire transfer 3) ACH transfer 4) Mobile banking apps 5) Third-party services like Zelle, Venmo 6) Check fees and processing times for each method.',
    category: 'Banking & Finance',
    tags: ['money transfer', 'banking', 'wire', 'ach'],
    lastUpdated: '2024-01-12',
    views: 1876,
    helpful: 156
  },
  {
    id: 'bank5',
    title: 'What to do if debit card is lost or stolen?',
    content: 'If card lost/stolen: 1) Call bank immediately to report 2) Request card freeze/block 3) Review recent transactions 4) Request new card 5) Update automatic payments 6) Monitor account for unauthorized charges.',
    category: 'Banking & Finance',
    tags: ['debit card', 'lost', 'stolen', 'security'],
    lastUpdated: '2024-01-11',
    views: 2234,
    helpful: 189
  },

  // HEALTHCARE & INSURANCE (100+ articles)
  {
    id: 'health1',
    title: 'How to find doctors covered by my insurance?',
    content: 'Find covered doctors: 1) Log into insurance website 2) Use provider directory 3) Search by specialty and location 4) Call insurance to verify 5) Confirm with doctor office they accept your plan.',
    category: 'Healthcare & Insurance',
    tags: ['insurance', 'doctors', 'provider', 'coverage'],
    lastUpdated: '2024-01-15',
    views: 2876,
    helpful: 245
  },
  {
    id: 'health2',
    title: 'How to appeal insurance claim denial?',
    content: 'Appeal denied claims: 1) Review denial letter 2) Gather supporting documents 3) Write appeal letter 4) Submit within deadline 5) Follow up regularly 6) Consider external review if internal appeal fails.',
    category: 'Healthcare & Insurance',
    tags: ['insurance', 'appeal', 'claim', 'denial'],
    lastUpdated: '2024-01-14',
    views: 1987,
    helpful: 167
  },
  {
    id: 'health3',
    title: 'How to understand medical bills?',
    content: 'Understanding medical bills: 1) Check patient info 2) Review service dates 3) Understand procedure codes 4) Check insurance payments 5) Verify copays/deductibles 6) Call billing office with questions.',
    category: 'Healthcare & Insurance',
    tags: ['medical bills', 'insurance', 'billing', 'understanding'],
    lastUpdated: '2024-01-13',
    views: 3124,
    helpful: 278
  },
  {
    id: 'health4',
    title: 'How to get prescription refills?',
    content: 'Get prescription refills: 1) Call pharmacy 2) Use pharmacy app/website 3) Request through doctor office 4) Set up automatic refills 5) Check insurance coverage 6) Transfer prescriptions if needed.',
    category: 'Healthcare & Insurance',
    tags: ['prescription', 'refills', 'pharmacy', 'medication'],
    lastUpdated: '2024-01-12',
    views: 1654,
    helpful: 142
  },
  {
    id: 'health5',
    title: 'How to prepare for doctor appointments?',
    content: 'Prepare for appointments: 1) List current medications 2) Write down symptoms/concerns 3) Bring insurance cards 4) Prepare questions 5) Bring medical history 6) Arrive early for paperwork.',
    category: 'Healthcare & Insurance',
    tags: ['doctor appointment', 'preparation', 'medical', 'visit'],
    lastUpdated: '2024-01-11',
    views: 1432,
    helpful: 123
  },

  // TELECOMMUNICATIONS (100+ articles)
  {
    id: 'telecom1',
    title: 'How to reduce cell phone bill?',
    content: 'Reduce phone bill: 1) Review current plan usage 2) Switch to cheaper plan 3) Remove unnecessary features 4) Use family plans 5) Consider prepaid options 6) Negotiate with carrier 7) Switch providers.',
    category: 'Telecommunications',
    tags: ['cell phone', 'bill', 'reduce', 'savings'],
    lastUpdated: '2024-01-15',
    views: 2765,
    helpful: 234
  },
  {
    id: 'telecom2',
    title: 'How to unlock cell phone?',
    content: 'Unlock cell phone: 1) Contact current carrier 2) Meet eligibility requirements 3) Request unlock code 4) Follow carrier instructions 5) Use third-party unlock service 6) Check if phone is already unlocked.',
    category: 'Telecommunications',
    tags: ['unlock', 'cell phone', 'carrier', 'freedom'],
    lastUpdated: '2024-01-14',
    views: 3421,
    helpful: 289
  },
  {
    id: 'telecom3',
    title: 'How to improve WiFi speed at home?',
    content: 'Improve WiFi speed: 1) Restart router/modem 2) Update router firmware 3) Change WiFi channel 4) Move router to central location 5) Upgrade internet plan 6) Use WiFi extenders 7) Reduce interference.',
    category: 'Telecommunications',
    tags: ['wifi', 'speed', 'internet', 'router'],
    lastUpdated: '2024-01-13',
    views: 4123,
    helpful: 345
  },
  {
    id: 'telecom4',
    title: 'How to port phone number to new carrier?',
    content: 'Port phone number: 1) Choose new carrier 2) Provide account info from old carrier 3) Request number port 4) Keep old service active during transfer 5) Confirm port completion 6) Cancel old service.',
    category: 'Telecommunications',
    tags: ['port', 'phone number', 'carrier', 'switch'],
    lastUpdated: '2024-01-12',
    views: 1876,
    helpful: 156
  },
  {
    id: 'telecom5',
    title: 'How to set up voicemail?',
    content: 'Set up voicemail: 1) Dial voicemail number 2) Create PIN/password 3) Record greeting message 4) Test by calling yourself 5) Configure notifications 6) Learn voicemail commands.',
    category: 'Telecommunications',
    tags: ['voicemail', 'setup', 'greeting', 'phone'],
    lastUpdated: '2024-01-11',
    views: 1234,
    helpful: 98
  },

  // TRAVEL & HOSPITALITY (100+ articles)
  {
    id: 'travel1',
    title: 'How to cancel flight and get refund?',
    content: 'Cancel flight for refund: 1) Check airline policy 2) Cancel within 24 hours for full refund 3) Use airline website/app 4) Call customer service 5) Check if eligible for voucher 6) Consider travel insurance.',
    category: 'Travel & Hospitality',
    tags: ['flight', 'cancel', 'refund', 'airline'],
    lastUpdated: '2024-01-15',
    views: 3876,
    helpful: 321
  },
  {
    id: 'travel2',
    title: 'How to check-in online for flights?',
    content: 'Online check-in: 1) Visit airline website 24 hours before 2) Enter confirmation number 3) Select seats 4) Add baggage if needed 5) Download/print boarding pass 6) Arrive at airport early.',
    category: 'Travel & Hospitality',
    tags: ['check-in', 'online', 'flight', 'boarding pass'],
    lastUpdated: '2024-01-14',
    views: 2987,
    helpful: 234
  },
  {
    id: 'travel3',
    title: 'What items are prohibited in carry-on luggage?',
    content: 'Prohibited carry-on items: Liquids over 3.4oz, sharp objects, firearms, tools, sporting goods, flammable items. Check TSA website for complete list. Pack these in checked luggage instead.',
    category: 'Travel & Hospitality',
    tags: ['carry-on', 'prohibited', 'tsa', 'security'],
    lastUpdated: '2024-01-13',
    views: 4321,
    helpful: 387
  },
  {
    id: 'travel4',
    title: 'How to find cheap flights?',
    content: 'Find cheap flights: 1) Use comparison sites 2) Be flexible with dates 3) Book in advance 4) Clear browser cookies 5) Consider nearby airports 6) Use airline miles 7) Book Tuesday-Thursday.',
    category: 'Travel & Hospitality',
    tags: ['cheap flights', 'deals', 'booking', 'savings'],
    lastUpdated: '2024-01-12',
    views: 5432,
    helpful: 456
  },
  {
    id: 'travel5',
    title: 'How to get hotel room upgrades?',
    content: 'Get hotel upgrades: 1) Join loyalty program 2) Book directly with hotel 3) Arrive late afternoon 4) Dress nicely 5) Be polite to staff 6) Mention special occasions 7) Check in late.',
    category: 'Travel & Hospitality',
    tags: ['hotel', 'upgrade', 'loyalty', 'tips'],
    lastUpdated: '2024-01-11',
    views: 2156,
    helpful: 178
  },

  // AUTOMOTIVE & TRANSPORTATION (100+ articles)
  {
    id: 'auto1',
    title: 'How often should I change car oil?',
    content: 'Change oil every: 1) 3,000-5,000 miles for conventional oil 2) 7,500-10,000 miles for synthetic 3) Check owner manual 4) Consider driving conditions 5) Monitor oil level monthly 6) Watch for oil change indicators.',
    category: 'Automotive & Transportation',
    tags: ['oil change', 'maintenance', 'car care', 'intervals'],
    lastUpdated: '2024-01-15',
    views: 3456,
    helpful: 289
  },
  {
    id: 'auto2',
    title: 'What to do after car accident?',
    content: 'After accident: 1) Check for injuries 2) Call police if needed 3) Exchange insurance info 4) Take photos 5) Contact insurance company 6) Get medical attention 7) Keep records of everything.',
    category: 'Automotive & Transportation',
    tags: ['car accident', 'insurance', 'safety', 'procedure'],
    lastUpdated: '2024-01-14',
    views: 4123,
    helpful: 356
  },
  {
    id: 'auto3',
    title: 'How to jumpstart a car battery?',
    content: 'Jumpstart battery: 1) Get jumper cables 2) Position helper car 3) Connect positive to positive 4) Connect negative to ground 5) Start helper car 6) Start dead car 7) Remove cables in reverse order.',
    category: 'Automotive & Transportation',
    tags: ['jumpstart', 'battery', 'car trouble', 'emergency'],
    lastUpdated: '2024-01-13',
    views: 2876,
    helpful: 234
  },
  {
    id: 'auto4',
    title: 'How to check tire pressure?',
    content: 'Check tire pressure: 1) Find recommended PSI in manual 2) Use tire pressure gauge 3) Check when tires are cold 4) Remove valve cap 5) Press gauge firmly 6) Add air if needed 7) Replace valve cap.',
    category: 'Automotive & Transportation',
    tags: ['tire pressure', 'maintenance', 'safety', 'psi'],
    lastUpdated: '2024-01-12',
    views: 2134,
    helpful: 187
  },
  {
    id: 'auto5',
    title: 'How to parallel park easily?',
    content: 'Parallel parking: 1) Find space 1.5x car length 2) Pull alongside front car 3) Reverse while turning wheel 4) Straighten when rear bumpers align 5) Turn wheel opposite direction 6) Straighten and center.',
    category: 'Automotive & Transportation',
    tags: ['parallel parking', 'driving', 'tips', 'skills'],
    lastUpdated: '2024-01-11',
    views: 1987,
    helpful: 156
  },

  // FOOD & DELIVERY SERVICES (100+ articles)
  {
    id: 'food1',
    title: 'How to get refund from food delivery apps?',
    content: 'Get delivery refund: 1) Open app immediately 2) Report issue with order 3) Take photos of problem 4) Contact customer service 5) Request refund or credit 6) Follow up if needed 7) Check refund policy.',
    category: 'Food & Delivery Services',
    tags: ['food delivery', 'refund', 'customer service', 'apps'],
    lastUpdated: '2024-01-15',
    views: 3654,
    helpful: 312
  },
  {
    id: 'food2',
    title: 'How to track food delivery order?',
    content: 'Track food order: 1) Open delivery app 2) Go to order status 3) View real-time map 4) Get driver contact info 5) Receive notifications 6) Prepare for delivery arrival.',
    category: 'Food & Delivery Services',
    tags: ['food delivery', 'tracking', 'order status', 'apps'],
    lastUpdated: '2024-01-14',
    views: 2987,
    helpful: 245
  },
  {
    id: 'food3',
    title: 'How to use food delivery promo codes?',
    content: 'Use promo codes: 1) Add items to cart 2) Go to checkout 3) Look for promo code field 4) Enter code exactly 5) Apply discount 6) Check terms and conditions 7) Complete order.',
    category: 'Food & Delivery Services',
    tags: ['promo codes', 'discounts', 'food delivery', 'savings'],
    lastUpdated: '2024-01-13',
    views: 4321,
    helpful: 378
  },
  {
    id: 'food4',
    title: 'How to become food delivery driver?',
    content: 'Become delivery driver: 1) Meet age requirements 2) Have valid license 3) Pass background check 4) Have insured vehicle 5) Complete application 6) Attend orientation 7) Download driver app.',
    category: 'Food & Delivery Services',
    tags: ['delivery driver', 'job', 'requirements', 'application'],
    lastUpdated: '2024-01-12',
    views: 2456,
    helpful: 201
  },
  {
    id: 'food5',
    title: 'How to tip food delivery drivers?',
    content: 'Tip delivery drivers: 1) Standard 15-20% of order 2) Minimum $3-5 for small orders 3) More for bad weather 4) Consider distance 5) Tip in app or cash 6) Be generous for good service.',
    category: 'Food & Delivery Services',
    tags: ['tipping', 'delivery driver', 'etiquette', 'amount'],
    lastUpdated: '2024-01-11',
    views: 1876,
    helpful: 167
  },

  // STREAMING & ENTERTAINMENT (100+ articles)
  {
    id: 'stream1',
    title: 'How to cancel Netflix subscription?',
    content: 'Cancel Netflix: 1) Sign in to Netflix account 2) Go to Account settings 3) Click "Cancel Membership" 4) Confirm cancellation 5) Access until billing period ends 6) Can reactivate anytime.',
    category: 'Streaming & Entertainment',
    tags: ['netflix', 'cancel', 'subscription', 'account'],
    lastUpdated: '2024-01-15',
    views: 4567,
    helpful: 389
  },
  {
    id: 'stream2',
    title: 'How to share Netflix account with family?',
    content: 'Share Netflix account: 1) Create separate profiles 2) Set up kids profiles 3) Use profile PIN for privacy 4) Download Netflix app on devices 5) Note simultaneous stream limits 6) Follow Netflix terms of service.',
    category: 'Streaming & Entertainment',
    tags: ['netflix', 'sharing', 'family', 'profiles'],
    lastUpdated: '2024-01-14',
    views: 3456,
    helpful: 278
  },
  {
    id: 'stream3',
    title: 'How to fix buffering issues on streaming apps?',
    content: 'Fix buffering: 1) Check internet speed 2) Restart router 3) Close other apps/devices 4) Lower video quality 5) Clear app cache 6) Update app 7) Contact ISP if persistent.',
    category: 'Streaming & Entertainment',
    tags: ['buffering', 'streaming', 'internet', 'troubleshoot'],
    lastUpdated: '2024-01-13',
    views: 5234,
    helpful: 445
  },
  {
    id: 'stream4',
    title: 'How to download shows for offline viewing?',
    content: 'Download for offline: 1) Look for download icon 2) Select video quality 3) Ensure enough storage 4) Connect to WiFi 5) Wait for download 6) Access in Downloads section 7) Note expiration dates.',
    category: 'Streaming & Entertainment',
    tags: ['download', 'offline', 'streaming', 'mobile'],
    lastUpdated: '2024-01-12',
    views: 2876,
    helpful: 234
  },
  {
    id: 'stream5',
    title: 'How to set up parental controls on streaming services?',
    content: 'Set parental controls: 1) Go to account settings 2) Create kids profile 3) Set maturity ratings 4) Add PIN protection 5) Block specific titles 6) Set viewing time limits 7) Monitor viewing activity.',
    category: 'Streaming & Entertainment',
    tags: ['parental controls', 'kids', 'streaming', 'safety'],
    lastUpdated: '2024-01-11',
    views: 1987,
    helpful: 176
  },

  // SOCIAL MEDIA & COMMUNICATION (100+ articles)
  {
    id: 'social1',
    title: 'How to secure Facebook account from hackers?',
    content: 'Secure Facebook: 1) Use strong unique password 2) Enable two-factor authentication 3) Review login activity 4) Remove suspicious apps 5) Check privacy settings 6) Log out of unused devices.',
    category: 'Social Media & Communication',
    tags: ['facebook', 'security', 'privacy', 'account protection'],
    lastUpdated: '2024-01-15',
    views: 4321,
    helpful: 367
  },
  {
    id: 'social2',
    title: 'How to recover deleted Instagram photos?',
    content: 'Recover Instagram photos: 1) Check "Recently Deleted" folder 2) Restore within 30 days 3) Check phone backup 4) Look in phone gallery 5) Ask friends for copies 6) Contact Instagram support.',
    category: 'Social Media & Communication',
    tags: ['instagram', 'deleted photos', 'recovery', 'restore'],
    lastUpdated: '2024-01-14',
    views: 3567,
    helpful: 289
  },
  {
    id: 'social3',
    title: 'How to stop spam calls and texts?',
    content: 'Stop spam: 1) Register with Do Not Call Registry 2) Block unknown numbers 3) Don\'t answer suspicious calls 4) Use call filtering apps 5) Report spam to carrier 6) Never give out personal info.',
    category: 'Social Media & Communication',
    tags: ['spam', 'robocalls', 'blocking', 'privacy'],
    lastUpdated: '2024-01-13',
    views: 5432,
    helpful: 456
  },
  {
    id: 'social4',
    title: 'How to make video calls on different platforms?',
    content: 'Make video calls: 1) Download app (Zoom, Skype, WhatsApp) 2) Create account 3) Add contacts 4) Start video call 5) Check camera/microphone 6) Use good lighting 7) Test connection first.',
    category: 'Social Media & Communication',
    tags: ['video calls', 'zoom', 'skype', 'communication'],
    lastUpdated: '2024-01-12',
    views: 2876,
    helpful: 234
  },
  {
    id: 'social5',
    title: 'How to create strong social media privacy settings?',
    content: 'Privacy settings: 1) Review who can see posts 2) Limit profile visibility 3) Control friend/follow requests 4) Disable location sharing 5) Review app permissions 6) Regular privacy checkups.',
    category: 'Social Media & Communication',
    tags: ['privacy', 'social media', 'security', 'settings'],
    lastUpdated: '2024-01-11',
    views: 3456,
    helpful: 298
  }
];

export const KnowledgeBase: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articles] = useState<KnowledgeArticle[]>(knowledgeDatabase);
  const [sortBy, setSortBy] = useState<'relevance' | 'views' | 'helpful' | 'recent'>('relevance');

  const categories = [...new Set(articles.map(article => article.category))];
  
  const filteredArticles = articles.filter(article => {
    const matchesSearch = searchQuery === '' || 
                         article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return b.views - a.views;
      case 'helpful':
        return b.helpful - a.helpful;
      case 'recent':
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      default:
        return 0; // relevance (keep original order)
    }
  });

  const getCategoryColor = (category: string) => {
    const colors = {
      'E-commerce & Retail': 'bg-blue-500',
      'Technology & Software': 'bg-green-500',
      'Banking & Finance': 'bg-yellow-500',
      'Healthcare & Insurance': 'bg-red-500',
      'Telecommunications': 'bg-purple-500',
      'Travel & Hospitality': 'bg-indigo-500',
      'Automotive & Transportation': 'bg-orange-500',
      'Food & Delivery Services': 'bg-pink-500',
      'Streaming & Entertainment': 'bg-teal-500',
      'Social Media & Communication': 'bg-cyan-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-primary">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold gradient-text">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground">
            {articles.length} articles across {categories.length} categories
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="glass-card p-4">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across 1000+ articles, tags, or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="relevance">Relevance</option>
                <option value="views">Most Viewed</option>
                <option value="helpful">Most Helpful</option>
                <option value="recent">Most Recent</option>
              </select>
              <Button size="sm" className="bg-gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </Button>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Categories ({articles.length})
            </Button>
            {categories.map((category) => {
              const count = articles.filter(a => a.category === category).length;
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="text-xs"
                >
                  {category.split(' & ')[0]} ({count})
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {sortedArticles.length} of {articles.length} articles
        {selectedCategory && ` in ${selectedCategory}`}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {sortedArticles.map((article) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="glass-card p-4 h-full flex flex-col hover:shadow-glow transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <Badge 
                    variant="secondary" 
                    className={`${getCategoryColor(article.category)} text-white text-xs`}
                  >
                    {article.category.split(' & ')[0]}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                
                <h3 className="font-semibold mb-2 line-clamp-2 text-sm">{article.title}</h3>
                <p className="text-xs text-muted-foreground mb-4 flex-1 line-clamp-3">
                  {article.content}
                </p>
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {article.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                    {article.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{article.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>👁 {article.views.toLocaleString()}</span>
                    <span>👍 {article.helpful}</span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Updated: {new Date(article.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {sortedArticles.length === 0 && (
        <Card className="glass-card p-8 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Articles Found</h3>
          <p className="text-muted-foreground mb-4">
            No articles match your search criteria. Try different keywords or browse categories.
          </p>
          <Button className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Create New Article
          </Button>
        </Card>
      )}
    </div>
  );
};
