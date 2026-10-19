// Default themes and starter menus ("super cool default values").
const THEMES = {
  tomato:   { primary: '#D62F25', accent: '#2E7D4F', bg: '#FFF6EC', card: '#FFFFFF', text: '#2B1B14', radius: 16, font: 'serif',   hero: 'gradient' },
  sunset:   { primary: '#C9431A', accent: '#F7B32B', bg: '#FFF3E6', card: '#FFFBF6', text: '#3B1E10', radius: 24, font: 'rounded', hero: 'sunset' },
  forest:   { primary: '#2F6B45', accent: '#E3A81C', bg: '#F3F5EE', card: '#FFFFFF', text: '#18271D', radius: 8,  font: 'serif',   hero: 'gradient' },
  midnight: { primary: '#FF5A36', accent: '#FFC93C', bg: '#0E1015', card: '#191C24', text: '#F4EFE7', radius: 14, font: 'modern',  hero: 'dark' },
  ocean:    { primary: '#0B6A88', accent: '#FF8A65', bg: '#EEF5F8', card: '#FFFFFF', text: '#0F2C38', radius: 0,  font: 'modern',  hero: 'gradient' },
  candy:    { primary: '#C8336A', accent: '#8B6CFF', bg: '#FFF1F6', card: '#FFFFFF', text: '#3A1430', radius: 40, font: 'rounded', hero: 'sunset' },
};

const L = (en, fr, ar) => ({ en, fr, ar });

const STARTERS = {
  pizzeria: {
    emoji: '🍕',
    tagline: L('Hand-stretched dough, baked in a stone oven', 'Pâte étirée à la main, cuite au four à pierre', 'عجين مفرود يدويًا ومخبوز في فرن حجري'),
    about: L('Fresh ingredients, a hot oven and a lot of love. Order online and pick it up or get it delivered.', 'Des produits frais, un four bien chaud et beaucoup d’amour. Commandez en ligne, à emporter ou en livraison.', 'مكونات طازجة وفرن ساخن وكثير من الحب. اطلب عبر الإنترنت واستلم طلبك أو اطلب التوصيل.'),
    categories: [
      { name: L('Pizzas', 'Pizzas', 'بيتزا'), emoji: '🍕', items: [
        [L('Margherita', 'Margherita', 'مارغريتا'), L('Tomato, mozzarella, basil', 'Tomate, mozzarella, basilic', 'طماطم، موتزاريلا، ريحان'), 8],
        [L('Pepperoni', 'Pepperoni', 'بيبروني'), L('Mozzarella, spicy pepperoni', 'Mozzarella, pepperoni épicé', 'موتزاريلا وبيبروني حار'), 10],
        [L('Four Cheeses', 'Quatre fromages', 'أربع أجبان'), L('Mozzarella, cheddar, blue cheese, parmesan', 'Mozzarella, cheddar, bleu, parmesan', 'موتزاريلا، شيدر، جبن أزرق، بارميزان'), 11],
        [L('Veggie', 'Végétarienne', 'نباتية'), L('Peppers, mushrooms, olives, onions', 'Poivrons, champignons, olives, oignons', 'فلفل، فطر، زيتون، بصل'), 9.5],
      ] },
      { name: L('Sides', 'Accompagnements', 'مقبلات'), emoji: '🍟', items: [
        [L('Garlic bread', 'Pain à l’ail', 'خبز الثوم'), L('Warm and crispy', 'Chaud et croustillant', 'ساخن ومقرمش'), 3.5],
        [L('Fries', 'Frites', 'بطاطس مقلية'), L('Golden and salted', 'Dorées et salées', 'ذهبية ومملحة'), 3],
      ] },
      { name: L('Drinks', 'Boissons', 'مشروبات'), emoji: '🥤', items: [
        [L('Soda', 'Soda', 'مشروب غازي'), L('33cl can', 'Canette 33cl', 'علبة 33 سل'), 2],
        [L('Water', 'Eau', 'ماء'), L('50cl bottle', 'Bouteille 50cl', 'زجاجة 50 سل'), 1],
      ] },
    ],
  },
  burger: {
    emoji: '🍔',
    tagline: L('Juicy burgers, made to order', 'Des burgers juteux, préparés à la commande', 'برغر شهي يُحضَّر عند الطلب'),
    about: L('Smashed patties, toasted buns and secret sauce. Hungry? You are in the right place.', 'Steaks smashés, pains toastés et sauce secrète. Une petite faim ? Vous êtes au bon endroit.', 'لحم مفروم طازج، خبز محمص وصلصة سرية. جائع؟ أنت في المكان الصحيح.'),
    categories: [
      { name: L('Burgers', 'Burgers', 'برغر'), emoji: '🍔', items: [
        [L('Classic', 'Classique', 'كلاسيك'), L('Beef, cheddar, pickles, secret sauce', 'Bœuf, cheddar, cornichons, sauce secrète', 'لحم بقري، شيدر، مخلل، صلصة سرية'), 7],
        [L('Double Cheese', 'Double fromage', 'دبل تشيز'), L('Two patties, double cheddar', 'Deux steaks, double cheddar', 'قطعتا لحم وشيدر مضاعف'), 9.5],
        [L('Crispy Chicken', 'Poulet croustillant', 'دجاج مقرمش'), L('Fried chicken, lettuce, mayo', 'Poulet frit, salade, mayo', 'دجاج مقلي، خس، مايونيز'), 8],
      ] },
      { name: L('Sides', 'Accompagnements', 'مقبلات'), emoji: '🍟', items: [
        [L('Fries', 'Frites', 'بطاطس مقلية'), L('Golden and salted', 'Dorées et salées', 'ذهبية ومملحة'), 3],
        [L('Onion rings', 'Rondelles d’oignon', 'حلقات البصل'), L('Crunchy rings', 'Croustillantes', 'مقرمشة'), 3.5],
      ] },
      { name: L('Drinks', 'Boissons', 'مشروبات'), emoji: '🥤', items: [
        [L('Soda', 'Soda', 'مشروب غازي'), L('33cl can', 'Canette 33cl', 'علبة 33 سل'), 2],
        [L('Milkshake', 'Milkshake', 'ميلك شيك'), L('Vanilla, chocolate or strawberry', 'Vanille, chocolat ou fraise', 'فانيلا، شوكولاتة أو فراولة'), 4.5],
      ] },
    ],
  },
  tacos: {
    emoji: '🌮',
    tagline: L('Big flavour, wrapped up', 'Plein de saveurs, bien emballées', 'نكهة كبيرة، ملفوفة بإتقان'),
    about: L('Tacos and wraps filled the way you like them. Pick your meat, your sauce, and enjoy.', 'Tacos et wraps garnis comme vous les aimez. Choisissez votre viande, votre sauce, et régalez-vous.', 'تاكوس ولفائف محشوة كما تحب. اختر لحمك وصلصتك واستمتع.'),
    categories: [
      { name: L('Tacos', 'Tacos', 'تاكوس'), emoji: '🌮', items: [
        [L('Chicken tacos', 'Tacos poulet', 'تاكوس دجاج'), L('Chicken, fries, cheese sauce', 'Poulet, frites, sauce fromagère', 'دجاج، بطاطس، صلصة الجبن'), 6],
        [L('Minced beef tacos', 'Tacos viande hachée', 'تاكوس لحم مفروم'), L('Beef, fries, cheese sauce', 'Viande hachée, frites, sauce fromagère', 'لحم مفروم، بطاطس، صلصة الجبن'), 6.5],
        [L('Mixed tacos', 'Tacos mixte', 'تاكوس مشكل'), L('Chicken and beef, extra cheese', 'Poulet et viande, fromage en plus', 'دجاج ولحم مع جبن إضافي'), 8],
      ] },
      { name: L('Drinks', 'Boissons', 'مشروبات'), emoji: '🥤', items: [
        [L('Soda', 'Soda', 'مشروب غازي'), L('33cl can', 'Canette 33cl', 'علبة 33 سل'), 2],
        [L('Water', 'Eau', 'ماء'), L('50cl bottle', 'Bouteille 50cl', 'زجاجة 50 سل'), 1],
      ] },
    ],
  },
  sandwich: {
    emoji: '🥙',
    tagline: L('Fresh sandwiches, kebabs and wraps', 'Sandwichs, kebabs et wraps frais', 'ساندويتشات وكباب ولفائف طازجة'),
    about: L('Grilled meat, crisp veggies and warm bread. Fast, fresh and filling.', 'Viande grillée, légumes croquants et pain chaud. Rapide, frais et copieux.', 'لحم مشوي وخضار مقرمشة وخبز ساخن. سريع وطازج ومشبع.'),
    categories: [
      { name: L('Sandwiches', 'Sandwichs', 'ساندويتشات'), emoji: '🥙', items: [
        [L('Chicken shawarma', 'Chawarma poulet', 'شاورما دجاج'), L('Garlic sauce, pickles, fries', 'Sauce ail, cornichons, frites', 'صلصة الثوم، مخلل، بطاطس'), 5],
        [L('Beef kebab', 'Kebab bœuf', 'كباب لحم'), L('Grilled beef, onions, tomato', 'Bœuf grillé, oignons, tomate', 'لحم مشوي، بصل، طماطم'), 6],
        [L('Falafel wrap', 'Wrap falafel', 'لفة فلافل'), L('Falafel, hummus, salad', 'Falafel, houmous, salade', 'فلافل، حمص، سلطة'), 4.5],
      ] },
      { name: L('Drinks', 'Boissons', 'مشروبات'), emoji: '🥤', items: [
        [L('Soda', 'Soda', 'مشروب غازي'), L('33cl can', 'Canette 33cl', 'علبة 33 سل'), 2],
        [L('Fresh juice', 'Jus frais', 'عصير طازج'), L('Orange or lemon-mint', 'Orange ou citron-menthe', 'برتقال أو ليمون بالنعناع'), 3],
      ] },
    ],
  },
  other: {
    emoji: '🍽️',
    tagline: L('Good food, fast', 'Bonne cuisine, rapidement', 'طعام شهي وسريع'),
    about: L('Welcome! Browse our menu and order in a few taps.', 'Bienvenue ! Parcourez notre menu et commandez en quelques clics.', 'مرحبًا! تصفح قائمتنا واطلب ببضع نقرات.'),
    categories: [
      { name: L('Our dishes', 'Nos plats', 'أطباقنا'), emoji: '🍽️', items: [
        [L('Dish of the day', 'Plat du jour', 'طبق اليوم'), L('Ask us what is cooking', 'Demandez-nous ce qui mijote', 'اسألنا عما نطهوه'), 8],
      ] },
      { name: L('Drinks', 'Boissons', 'مشروبات'), emoji: '🥤', items: [
        [L('Soda', 'Soda', 'مشروب غازي'), L('33cl can', 'Canette 33cl', 'علبة 33 سل'), 2],
      ] },
    ],
  },
};

const DEFAULT_SECTIONS = [
  { id: 'hero', on: true }, { id: 'menu', on: true }, { id: 'about', on: true },
  { id: 'hours', on: true }, { id: 'contact', on: true },
];

const defaultHours = () => Array.from({ length: 7 }, () => ({ open: '10:00', close: '23:00', closed: false }));

module.exports = { THEMES, STARTERS, DEFAULT_SECTIONS, defaultHours };
