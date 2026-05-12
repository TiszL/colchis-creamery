import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ARTICLES = [
  {
    slug: "the-stone-and-the-curd",
    title: "The stone, the curd, and two thousand years",
    excerpt: "Why the cheese in your kitchen has roots older than Rome — and what an Ohio creamery owes to a village in Samegrelo.",
    tags: "Heritage",
    content: `The stone weighs forty pounds and has a chip on one corner where my grandmother dropped it on the kitchen floor in 1974. She was making sulguni, the way her mother taught her, the way her mother's mother taught her — heat the curds in salted whey, knead with both hands, and then press, with a stone, until the shape holds.\n\nI have that stone now, in Dublin, Ohio. It sits on a shelf in our creamery between a digital pH meter and a stack of food-safety paperwork from the state of Ohio.\n\n## What we mean by 'two thousand years'\n\nCheese has been made in the Caucasus for as long as people have kept domesticated cows. The earliest archaeological evidence goes back to the late Bronze Age, somewhere around 1500 BCE.\n\n## What we owe to the village\n\nWhen my parents left Tbilisi in 1991, they took two suitcases. One was full of clothes; the other had a wedge of sulguni wrapped in cheesecloth, a jar of pickled jonjoli, and the stone.\n\n## What 'fresh every day' actually means\n\nSulguni does not keep. The fresh kind is best within ten days. So we make it every morning. The milk arrives at six. The wheels go into brine at eleven. By five in the afternoon, the day's batch is in a cooler on its way to UPS.`,
    publishedAt: new Date("2026-05-04"),
  },
  {
    slug: "pop-up-german-village",
    title: "Pop-up Saturday — German Village Farmers' Market",
    excerpt: "We'll be at the corner of Mohawk and Frankfort with hot adjaruli and 200 wheels of fresh sulguni. Get there early.",
    tags: "Updates",
    content: "This Saturday we are setting up a pop-up at the German Village Farmers' Market in Columbus. We'll have hot adjaruli khachapuri ready to eat, fresh sulguni wheels, and aged sulguni with honey. We start at 8 AM and we sell out fast.",
    publishedAt: new Date("2026-05-02"),
  },
  {
    slug: "milk-of-three-rivers",
    title: "The milk of three rivers",
    excerpt: "We drive to three Ohio dairies every morning before sunrise. Here is why none of them are bigger than 80 cows.",
    tags: "Sourcing",
    content: "Every morning before sunrise, our truck pulls out of Tuller Road and drives to three small dairies in central Ohio. None of them milk more than 80 cows. We know each farmer by name, and we know their herds. The milk we use for sulguni and imeruli arrives at our creamery within four hours of milking — warm, whole, and un-homogenized.",
    publishedAt: new Date("2026-04-28"),
  },
  {
    slug: "khachapuri-explained",
    title: "A field guide to khachapuri",
    excerpt: "Adjaruli, Imeruli, Megruli, Penovani, Ossuri — five breads, five regions, one country. A primer for first-timers.",
    tags: "Field Notes",
    content: "Khachapuri is not one bread. It is a family of cheese-breads, and each region of Georgia has its own shape, its own dough, its own ratio of cheese to bread. Adjaruli is the show-off — boat-shaped, egg yolk on top. Imeruli is the everyday — round, stuffed, no yeast. Megruli doubles down on cheese. Penovani is flaky. Ossuri is from the mountains.",
    publishedAt: new Date("2026-04-22"),
  },
  {
    slug: "eater-midwest-feature",
    title: "Eater Midwest names us a 'best new bakery'",
    excerpt: "We are stunned and grateful. Read Brett Anderson's piece on what is happening on Tuller Road this spring.",
    tags: "Press",
    content: "Eater Midwest has named Colchis Food one of the best new bakeries in the Midwest for spring 2026. Brett Anderson visited us on a Tuesday, ate three khachapuri, and watched us make sulguni from scratch. We are deeply grateful for the attention and the kind words.",
    publishedAt: new Date("2026-04-18"),
  },
  {
    slug: "supra-at-home",
    title: "How to set a supra at home",
    excerpt: "The Georgian feast is a structure, not a menu. Toasts, tamada, and the order of the table — for a Tuesday in Ohio.",
    tags: "Heritage",
    content: "A supra is not just a dinner party. It is a structured event with a tamada (toastmaster), a specific order of toasts, and a table that groans under the weight of food. You do not need twenty people to hold one. You need three dishes, some wine, and a willingness to say something honest when it is your turn to toast.",
    publishedAt: new Date("2026-04-14"),
  },
  {
    slug: "sulguni-vs-mozzarella",
    title: "Sulguni is not mozzarella, exactly",
    excerpt: "They are cousins from the same pasta-filata family — pulled, stretched, brined. Here is what makes them different.",
    tags: "Field Notes",
    content: "Sulguni and mozzarella are both pasta-filata cheeses — meaning the curds are heated, stretched, and pulled. They share a family tree. But sulguni is brined for 24 hours, which gives it a saltier, more complex flavor. And the texture is denser — you can slice it, grill it, even smoke it. Mozzarella is fresh and milky. Sulguni is savory and robust.",
    publishedAt: new Date("2026-04-08"),
  },
  {
    slug: "wholesale-launch",
    title: "Wholesale program is open for Spring 2026",
    excerpt: "Restaurants, grocers, and caterers in OH/MI/IN/PA/KY: we are accepting accounts. Sample boxes ship Mondays.",
    tags: "Updates",
    content: "Our wholesale program is now open. We are accepting applications from restaurants, independent grocers, and caterers in Ohio, Michigan, Indiana, Pennsylvania, and Kentucky. We offer three tiers: Restaurant, Grocery, and Private Label. Sample boxes ship every Monday. Apply on our wholesale page or email wholesale@colchisfood.com.",
    publishedAt: new Date("2026-04-01"),
  },
];

const RECIPES = [
  {
    slug: "adjaruli-at-home",
    title: "Adjaruli khachapuri, weekend project",
    description: "The boat-shaped one. Yeasted dough, sulguni and imeruli inside, an egg yolk and a pat of butter on top.",
    prepTime: "3 hours",
    cookTime: "15 min",
    servings: "4",
    difficulty: "Project",
    content: "Adjaruli is the show-off of the khachapuri family. It takes about three hours, most of it waiting on dough. But it is worth a Saturday.",
    contentBlocks: JSON.stringify({
      ingredients: [
        { group: "Dough", items: ["500g bread flour", "300ml warm milk", "7g instant yeast", "10g fine salt", "1 tbsp olive oil", "1 tsp sugar"] },
        { group: "Filling & top", items: ["300g Colchis Sulguni Fresh, shredded", "200g Colchis Imeruli, crumbled", "4 egg yolks", "60g cold butter, in cubes", "Flaky salt", "Black pepper"] },
      ],
      steps: [
        { t: "Bloom the yeast", d: "Stir yeast and sugar into warm milk and let it foam — 8 minutes." },
        { t: "Mix and knead", d: "Combine flour, salt, oil. Pour in the yeast milk. Knead 10 minutes by hand." },
        { t: "First rise", d: "Cover and let rise in a warm spot until doubled — 60 to 90 minutes." },
        { t: "Shape the boats", d: "Divide into 4. Roll each into an oval, pinch and twist into a boat shape." },
        { t: "Fill", d: "Mix the sulguni and imeruli with yogurt and egg. Mound into each well." },
        { t: "Bake hot", d: "500°F for 12 minutes on a preheated stone. Pull, drop a yolk, scatter butter, return for 90 seconds." },
        { t: "Eat with your hands", d: "Tear the rim, swirl through the molten yolk and butter, and dip." },
      ],
      cuisine: "Traditional",
      ka: "აჭარული ხაჭაპური",
      pairing: "Sulguni Fresh + Imeruli",
      diet: ["Vegetarian"],
    }),
  },
  {
    slug: "imeruli-quick",
    title: "Imeruli khachapuri, on a Tuesday",
    description: "Round, stuffed with cheese, no yeast. The version Georgians actually make on a weeknight.",
    prepTime: "45 min",
    servings: "4",
    difficulty: "Easy",
    content: "This is the weeknight khachapuri. No yeast, no waiting. Just flour, yogurt, cheese, and a hot pan.",
    contentBlocks: JSON.stringify({ cuisine: "Traditional", ka: "იმერული ხაჭაპური", pairing: "Imeruli + Sulguni Aged", diet: ["Vegetarian", "Quick"] }),
  },
  {
    slug: "sulguni-grilled-cheese",
    title: "Sulguni grilled cheese, with walnut",
    description: "Three things: sulguni, sourdough, a spoon of walnut tkemali. The best lunch you'll make this month.",
    prepTime: "15 min",
    servings: "2",
    difficulty: "Easy",
    content: "A Georgian-American grilled cheese. Thick-sliced sulguni on sourdough, pressed in butter, served with walnut tkemali.",
    contentBlocks: JSON.stringify({ cuisine: "Modern", pairing: "Sulguni Fresh", diet: ["Vegetarian", "Quick"] }),
  },
  {
    slug: "lobio-pot",
    title: "Lobio — red bean stew with adjika",
    description: "Red kidney beans, walnut, marigold, coriander. We eat it with mchadi corn cakes and a wedge of imeruli.",
    prepTime: "1.5 hours",
    servings: "6",
    difficulty: "Easy",
    content: "Lobio is the comfort food of Georgia. Red kidney beans, slow-simmered with walnuts, marigold, and coriander.",
    contentBlocks: JSON.stringify({ cuisine: "Traditional", ka: "ლობიო", pairing: "Imeruli on the side", diet: ["Vegan", "Gluten-free"] }),
  },
  {
    slug: "khinkali-bites",
    title: "Khinkali — soup dumplings, the Tbilisi way",
    description: "Pleated dumplings full of broth and beef. Pinch the top, hold the topknot, do not let the soup escape.",
    prepTime: "2 hours",
    servings: "4",
    difficulty: "Project",
    content: "Khinkali are Georgian soup dumplings. The dough is simple — flour and water. The filling is seasoned beef with lots of onion and cilantro.",
    contentBlocks: JSON.stringify({ cuisine: "Traditional", ka: "ხინკალი", diet: [] }),
  },
  {
    slug: "ojakhuri-skillet",
    title: "Ojakhuri — pork & potatoes, one skillet",
    description: "Family-style. Pork shoulder, golden potatoes, tons of cilantro and red onion at the end.",
    prepTime: "1 hour",
    servings: "4",
    difficulty: "Easy",
    content: "Ojakhuri means 'family-style' in Georgian. Pork shoulder cubed, browned, tossed with golden potatoes.",
    contentBlocks: JSON.stringify({ cuisine: "Traditional", ka: "ოჯახური", diet: ["Gluten-free"] }),
  },
  {
    slug: "sulguni-cornbread",
    title: "Mchadi — corn bread, sulguni inside",
    description: "Cornmeal cakes pan-fried in butter with a slab of sulguni melted into the middle. A breakfast or a side.",
    prepTime: "25 min",
    servings: "4",
    difficulty: "Easy",
    content: "Mchadi are dense cornmeal cakes, pan-fried until golden. Split one open and stuff a slab of sulguni inside.",
    contentBlocks: JSON.stringify({ cuisine: "Traditional", ka: "მჭადი", pairing: "Sulguni Fresh", diet: ["Vegetarian", "Gluten-free", "Quick"] }),
  },
  {
    slug: "khachapuri-bites",
    title: "Khachapuri party bites, 30 minutes",
    description: "Puff pastry squares, sulguni and imeruli, an egg wash. Trays of these for any party, any holiday.",
    prepTime: "30 min",
    servings: "8",
    difficulty: "Easy",
    content: "The cheater's khachapuri. Store-bought puff pastry, cut into squares, filled with shredded sulguni and crumbled imeruli.",
    contentBlocks: JSON.stringify({ cuisine: "Modern", pairing: "Sulguni + Imeruli", diet: ["Vegetarian", "Quick"] }),
  },
  {
    slug: "pkhali-trio",
    title: "Pkhali — three walnut spreads",
    description: "Spinach, beet, and red bean — each pounded with walnuts, garlic, and marigold. The Georgian welcome plate.",
    prepTime: "1 hour",
    servings: "6",
    difficulty: "Medium",
    content: "Pkhali are walnut-paste spreads, shaped into balls or quenelles, topped with pomegranate seeds.",
    contentBlocks: JSON.stringify({ cuisine: "Traditional", ka: "ფხალი", diet: ["Vegan", "Gluten-free"] }),
  },
  {
    slug: "shredded-pasta-bake",
    title: "Sulguni-shred pasta, baked",
    description: "Our shredded imeruli was made for this. Pasta, tomato, lots of melted shred, baked till bubbling.",
    prepTime: "50 min",
    servings: "6",
    difficulty: "Easy",
    content: "A baked pasta that uses our shredded imeruli the way you'd use mozzarella on a lasagna — but better.",
    contentBlocks: JSON.stringify({ cuisine: "Modern", pairing: "Shredded Imeruli", diet: ["Vegetarian"] }),
  },
  {
    slug: "holiday-supra-spread",
    title: "Holiday supra — a Georgian feast plan",
    description: "A full menu for 12: pkhali, lobio, khachapuri, ojakhuri, walnut sauces, and the toasts that hold it together.",
    prepTime: "all day",
    servings: "12",
    difficulty: "Project",
    content: "This is a full Georgian feast plan for twelve people. It takes all day. You will need help. The result is a table so full you cannot see the tablecloth.",
    contentBlocks: JSON.stringify({ cuisine: "Holiday", ka: "სუფრა", diet: [] }),
  },
  {
    slug: "easter-paska",
    title: "Easter paska, with sulguni twist",
    description: "A bread that sits on the holiday table for a week. Ours folds in a layer of sulguni and a swirl of saffron.",
    prepTime: "4 hours",
    servings: "8",
    difficulty: "Project",
    content: "Paska is a tall, enriched bread traditionally baked for Easter. Our version adds a spiral of sulguni and threads of saffron.",
    contentBlocks: JSON.stringify({ cuisine: "Holiday", diet: ["Vegetarian"] }),
  },
];

async function main() {
  console.log("🌾 Seeding editorial content...");

  for (const a of ARTICLES) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: { title: a.title, excerpt: a.excerpt, tags: a.tags, content: a.content, isPublished: true, publishedAt: a.publishedAt },
      create: { ...a, isPublished: true },
    });
    console.log(`  ✓ Article: ${a.slug}`);
  }

  for (const r of RECIPES) {
    await prisma.recipe.upsert({
      where: { slug: r.slug },
      update: { title: r.title, description: r.description, content: r.content, contentBlocks: r.contentBlocks, prepTime: r.prepTime, cookTime: r.cookTime, servings: r.servings, difficulty: r.difficulty, isPublished: true },
      create: { ...r, isPublished: true },
    });
    console.log(`  ✓ Recipe: ${r.slug}`);
  }

  console.log(`\n✅ Seeded ${ARTICLES.length} articles + ${RECIPES.length} recipes`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
