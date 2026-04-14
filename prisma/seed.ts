import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Colchis Creamery database...");

  // ─── Admin User ──────────────────────────────────────────────────────────
  const adminPasswordHash = await hash("admin123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@colchiscreamery.com" },
    update: {},
    create: {
      email: "admin@colchiscreamery.com",
      passwordHash: adminPasswordHash,
      role: "MASTER_ADMIN",
      name: "Master Admin",
      companyName: "Colchis Creamery",
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  // ─── Products ────────────────────────────────────────────────────────────
  const products = [
    {
      sku: "CC-SULG-001",
      name: "Artisanal Sulguni",
      slug: "artisanal-sulguni",
      description:
        "Our flagship Sulguni is handcrafted using a centuries-old Georgian stretching technique passed down through generations. This brined, semi-soft cheese features a delicate layered texture that pulls apart in satisfying strings. Made from the milk of grass-fed cows in the lush Colchis lowlands, each wheel is carefully shaped and aged in a natural brine bath for optimal flavor development.",
      flavorProfile:
        "Mild, milky, and slightly tangy with a pleasant saltiness. The stretched-curd process gives it a buttery richness with a clean, lactic finish.",
      pairsWith:
        "Fresh herbs like tarragon and cilantro, Georgian flatbread (shotis puri), ripe tomatoes, walnuts, and a crisp Tsinandali white wine.",
      weight: "350g",
      ingredients:
        "Pasteurized cow's milk, salt, natural cultures, vegetarian rennet",
      imageUrl: "/images/products/artisanal-sulguni.jpg",
      priceB2c: "24.99",
      priceB2b: "18.99",
      stockQuantity: 120,
    },
    {
      sku: "CC-SULG-SMK-002",
      name: "Smoked Sulguni",
      slug: "smoked-sulguni",
      description:
        "Our Smoked Sulguni takes the classic Georgian cheese and elevates it through a traditional cold-smoking process over alder and fruit wood chips. The result is a golden-amber exterior encasing a supple, melt-in-your-mouth interior. The smoking imparts a deep, aromatic complexity that has made this variety a beloved staple in Georgian cuisine for centuries.",
      flavorProfile:
        "Rich and smoky with caramelized notes on the rind. The interior remains creamy and slightly elastic, balancing the smokiness with a gentle tang and savory depth.",
      pairsWith:
        "Dark rye bread, pickled vegetables, roasted red peppers, strong Georgian amber wine (Rkatsiteli), or a robust craft beer.",
      weight: "350g",
      ingredients:
        "Pasteurized cow's milk, salt, natural cultures, vegetarian rennet. Cold-smoked over natural alder and fruit wood.",
      imageUrl: "/images/products/smoked-sulguni.jpg",
      priceB2c: "27.99",
      priceB2b: "21.99",
      stockQuantity: 85,
    },
    {
      sku: "CC-IMER-003",
      name: "Imeretian Cheese",
      slug: "imeretian-cheese",
      description:
        "Imeruli kveli is the cornerstone of Georgian cuisine and the essential cheese for authentic khachapuri. Originating from the Imereti region, this fresh, brined cheese has a soft and crumbly texture that melts beautifully. We follow the traditional method of using natural whey-based cultures that give Imeretian cheese its distinctive character, unlike any Western cheese.",
      flavorProfile:
        "Fresh, bright, and mildly salty with a creamy, slightly acidic tang. It has a clean dairy taste that is delicate yet unmistakable, reminiscent of fresh morning milk.",
      pairsWith:
        "Essential for khachapuri and achma. Also wonderful crumbled over salads, paired with fresh cucumbers, watermelon, or alongside Georgian churchkhela (walnut and grape candy).",
      weight: "400g",
      ingredients:
        "Pasteurized cow's milk, whey culture, salt, vegetarian rennet",
      imageUrl: "/images/products/imeretian-cheese.jpg",
      priceB2c: "22.99",
      priceB2b: "16.99",
      stockQuantity: 150,
    },
    {
      sku: "CC-RSRV-004",
      name: "Aged Colchis Reserve",
      slug: "aged-colchis-reserve",
      description:
        "Our premium reserve cheese is aged for a minimum of six months in carefully controlled conditions, developing a complex depth of flavor that represents the pinnacle of Georgian cheesemaking. Inspired by aged mountain cheeses of the Caucasus, this firm cheese develops crystalline pockets of concentrated flavor and a rich, amber-hued paste that deepens with each week of maturation.",
      flavorProfile:
        "Bold, nutty, and intensely savory with notes of toasted hazelnuts, caramel, and dried herbs. Slight crystalline crunch from natural calcium lactate crystals adds textural intrigue. Long, warm finish.",
      pairsWith:
        "Aged Georgian Saperavi red wine, quince paste, dark honey, toasted walnuts, or shaved over grilled meats and roasted vegetables.",
      weight: "250g",
      ingredients:
        "Pasteurized cow's milk, salt, natural cultures, traditional rennet",
      imageUrl: "/images/products/aged-colchis-reserve.jpg",
      priceB2c: "34.99",
      priceB2b: "27.99",
      stockQuantity: 45,
    },
    {
      sku: "CC-BLND-005",
      name: "Georgian Cheese Blend",
      slug: "georgian-cheese-blend",
      description:
        "A versatile shredded blend of our Sulguni and Imeretian cheeses, perfectly proportioned for melting. This blend captures the best of both worlds: the stretchy, golden pull of Sulguni combined with the creamy melt of Imeretian cheese. Designed for home cooks who want authentic Georgian flavor without the prep work, it is the secret ingredient for perfect khachapuri every time.",
      flavorProfile:
        "Balanced and approachable with a harmonious combination of mild tang, gentle saltiness, and creamy butteriness. Melts into a luscious, stretchy golden pool.",
      pairsWith:
        "Ideal for khachapuri, pizza, quesadillas, grilled cheese sandwiches, pasta bakes, and any recipe calling for a superior melting cheese.",
      weight: "300g",
      ingredients:
        "Pasteurized cow's milk, salt, natural cultures, vegetarian rennet (contains Sulguni and Imeretian cheese blend)",
      imageUrl: "/images/products/georgian-cheese-blend.jpg",
      priceB2c: "19.99",
      priceB2b: "14.99",
      stockQuantity: 200,
    },
  ];

  for (const product of products) {
    const created = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
    console.log(`Created product: ${created.name} (${created.sku})`);
  }

  // ─── Product Lines & Categories ──────────────────────────────────────────
  const reserveLine = await prisma.productLine.upsert({
    where: { slug: "reserve" },
    update: {},
    create: {
      slug: "reserve",
      name: "Colchis Reserve™",
      tagline: "Slow Pasteurized · LTLT · Premium Artisanal",
      description:
        "The ultimate artisanal experience. Our Reserve line features products crafted using traditional slow-pasteurization (LTLT) methods, preserving the full depth of flavor from our 100% Grass-Fed A2 Brown Swiss Milk.",
      badgeColor: "#CBA153",
      sortOrder: 0,
    },
  });
  console.log(`Created product line: ${reserveLine.name}`);

  const classicLine = await prisma.productLine.upsert({
    where: { slug: "classic" },
    update: {},
    create: {
      slug: "classic",
      name: "Colchis Classic",
      tagline: "Fast Pasteurized · HTST · Accessible Excellence",
      description:
        "Everyday excellence for the whole family. Our Classic line delivers the same A2 Brown Swiss milk quality through efficient HTST pasteurization, making authentic Georgian dairy accessible for daily enjoyment.",
      badgeColor: "#8B9DAF",
      sortOrder: 1,
    },
  });
  console.log(`Created product line: ${classicLine.name}`);

  // Reserve categories
  const reserveCategories = [
    { slug: "pulled-curd-cheese", name: "Pulled-Curd Cheese", description: "Traditional stretched and brined cheeses", sortOrder: 0 },
    { slug: "fresh-cultured-cheese", name: "Fresh Cultured Cheese", description: "Soft, fresh farmer's cheeses and curds", sortOrder: 1 },
    { slug: "aged-cheese", name: "Aged Cheese", description: "Long-aged reserve wheels with complex flavor", sortOrder: 2 },
    { slug: "smoked-cheese", name: "Smoked Cheese", description: "Cold-smoked artisanal varieties", sortOrder: 3 },
    { slug: "whey-spread", name: "Whey Spread", description: "Creamy whey-based spreads", sortOrder: 4 },
    { slug: "cultured-butter", name: "Cultured Butter", description: "Slow-churned heritage butter", sortOrder: 5 },
  ];

  for (const cat of reserveCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, productLineId: reserveLine.id },
    });
    console.log(`  Created category: ${cat.name} (Reserve)`);
  }

  // Classic categories
  const classicCategories = [
    { slug: "everyday-cheese", name: "Everyday Cheese", description: "Classic cheeses for daily cooking and snacking", sortOrder: 0 },
    { slug: "shredded-blends", name: "Shredded Blends", description: "Pre-shredded cheese blends for convenience", sortOrder: 1 },
    { slug: "fresh-cheese", name: "Fresh Cheese", description: "Fresh, soft cheeses for salads and cooking", sortOrder: 2 },
    { slug: "classic-butter", name: "Butter", description: "Pure A2 butter for everyday use", sortOrder: 3 },
    { slug: "classic-spreads", name: "Spreads & Dips", description: "Ready-to-eat spreads and dips", sortOrder: 4 },
  ];

  for (const cat of classicCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, productLineId: classicLine.id },
    });
    console.log(`  Created category: ${cat.name} (Classic)`);
  }

  // ─── Recipes ─────────────────────────────────────────────────────────────
  const recipes = [
    {
      title: "Classic Imeretian Khachapuri",
      slug: "classic-imeretian-khachapuri",
      description:
        "The quintessential Georgian cheese bread, baked to golden perfection with a molten Imeretian cheese filling. This Imeretian-style khachapuri is round and enclosed, with a crisp, flaky exterior that gives way to an oozing, savory center.",
      content: `## Classic Imeretian Khachapuri

### Introduction
Khachapuri is the soul of Georgian cuisine. This Imeretian version (Imeruli khachapuri) is the most widespread style across Georgia, featuring a round, enclosed flatbread stuffed with cheese. The key to an authentic version lies in using genuine Imeretian cheese, which provides the perfect melt and tang.

### Ingredients

**For the dough:**
- 500g all-purpose flour
- 250ml warm matsoni (or plain yogurt)
- 1 egg
- 50g butter, melted
- 1 tsp salt
- 1 tsp baking soda

**For the filling:**
- 500g Colchis Creamery Imeretian Cheese, crumbled
- 1 egg
- 2 tbsp butter, softened

### Instructions

1. **Make the dough:** In a large bowl, combine the flour and salt. Create a well in the center. Mix the matsoni, egg, melted butter, and baking soda, then pour into the well. Mix until a soft dough forms. Knead on a floured surface for 5 minutes until smooth and elastic. Cover and rest for 30 minutes.

2. **Prepare the filling:** Crumble the Imeretian cheese into a bowl. Mix in the egg and softened butter until well combined. The mixture should be moist but hold together.

3. **Assemble:** Divide the dough into 4 equal portions. Roll each portion into a circle about 25cm in diameter. Place a quarter of the cheese filling in the center. Gather the edges up and over the filling, pinching together at the top. Gently flip seam-side down and press lightly, then roll out to about 1cm thickness, being careful not to tear the dough.

4. **Bake:** Preheat the oven to 220C (425F). Place the khachapuri on a lined baking sheet. Bake for 15-20 minutes until golden brown and puffed.

5. **Serve:** Brush the hot khachapuri generously with butter. Cut into wedges and serve immediately while the cheese is still molten and stretchy.

### Tips
- Do not over-roll the assembled khachapuri or the cheese will break through.
- The dough should be soft and slightly sticky for the best texture.
- For an extra-golden crust, brush with egg wash before baking.`,
      prepTime: "20 minutes",
      cookTime: "20 minutes",
      servings: "4",
      difficulty: "Intermediate",
      imageUrl: "/images/recipes/imeretian-khachapuri.jpg",
    },
    {
      title: "Adjaruli Khachapuri (Boat-Shaped Cheese Bread)",
      slug: "adjaruli-khachapuri",
      description:
        "The iconic boat-shaped khachapuri from the Adjara region, featuring a bubbling cheese center topped with a raw egg and butter that you mix together at the table. A spectacular centerpiece for any Georgian feast.",
      content: `## Adjaruli Khachapuri

### Introduction
Adjaruli khachapuri, or Adjarian khachapuri, is arguably the most dramatic and beloved version of Georgia's national dish. Shaped like a boat and filled with a river of melted cheese, it is finished with a raw egg and a knob of butter added just as it emerges from the oven. The diner stirs the egg and butter into the molten cheese, creating an incredibly rich, silky filling that is scooped up with torn pieces of the crispy bread edges.

### Ingredients

**For the dough:**
- 500g bread flour
- 300ml warm water
- 7g instant yeast
- 1 tbsp sugar
- 1 tsp salt
- 2 tbsp vegetable oil

**For the filling:**
- 350g Colchis Creamery Georgian Cheese Blend
- 150g Colchis Creamery Imeretian Cheese, crumbled
- 1 egg (for the filling mixture)
- 4 eggs (for topping, one per boat)
- 80g butter, cut into 4 pieces

### Instructions

1. **Make the dough:** Dissolve the yeast and sugar in warm water. Let it sit for 5 minutes until foamy. Mix flour and salt in a large bowl. Add the yeast mixture and oil. Knead for 8-10 minutes until smooth and elastic. Cover and let rise for 1 hour until doubled in size.

2. **Prepare the filling:** Combine the Georgian Cheese Blend and crumbled Imeretian cheese. Mix in one egg to bind the filling.

3. **Shape the boats:** Divide the dough into 4 pieces. Roll each into an oval shape, roughly 30cm long and 15cm wide. Fold up the long edges by about 3cm, then twist and pinch the two ends together to form pointed tips, creating a boat shape. Place on a lined baking sheet.

4. **Fill and bake:** Divide the cheese filling among the four boats, piling it generously into the center. Bake at 230C (450F) for 12-15 minutes until the dough is golden and the cheese is bubbling.

5. **Finish:** Remove from the oven. Quickly make a small well in the center of the cheese. Crack a raw egg into each boat and place a piece of butter beside it. Return to the oven for just 1-2 minutes, until the egg white barely begins to set but the yolk remains runny.

6. **Serve immediately:** Bring to the table at once. Show your guests how to stir the egg and butter into the hot cheese with a fork, then tear off pieces of the crusty bread edges to scoop up the rich, molten filling.

### Tips
- The egg should remain mostly raw and cook only from the heat of the cheese.
- Use a mix of cheeses for the best texture and flavor.
- Serve immediately; this dish does not wait.`,
      prepTime: "30 minutes",
      cookTime: "15 minutes",
      servings: "4",
      difficulty: "Advanced",
      imageUrl: "/images/recipes/adjaruli-khachapuri.jpg",
    },
    {
      title: "Smoked Sulguni and Walnut Pkhali",
      slug: "smoked-sulguni-walnut-pkhali",
      description:
        "A vibrant Georgian appetizer combining smoked Sulguni with the traditional walnut-herb paste known as pkhali. Spinach is blended with toasted walnuts, garlic, and aromatic spices, then topped with slices of golden smoked cheese.",
      content: `## Smoked Sulguni and Walnut Pkhali

### Introduction
Pkhali is one of the jewels of the Georgian supra (feast) table. These elegant vegetable and walnut rolls or balls are traditionally made with spinach, beet greens, or cabbage. In this recipe, we pair the classic spinach pkhali with our Smoked Sulguni, whose golden, aromatic character adds a wonderful depth to the fresh, herbaceous walnut paste.

### Ingredients

- 500g fresh spinach, washed
- 150g walnuts, lightly toasted
- 3 cloves garlic
- 1 small onion, finely diced
- 1 tsp ground coriander
- 1/2 tsp ground fenugreek (blue fenugreek if available)
- 1/4 tsp ground cayenne pepper
- 3 tbsp red wine vinegar
- 1/2 bunch fresh cilantro
- Salt to taste
- 200g Colchis Creamery Smoked Sulguni, thinly sliced
- Pomegranate seeds for garnish

### Instructions

1. **Cook the spinach:** Blanch the spinach in boiling salted water for 1-2 minutes. Drain and immediately plunge into ice water. Squeeze out all excess moisture thoroughly. This step is crucial; the spinach must be very dry.

2. **Make the walnut paste:** In a food processor, pulse the toasted walnuts until finely ground but not yet a butter. Add garlic, onion, cilantro, and all spices. Pulse to combine into a coarse paste.

3. **Combine:** Finely chop the blanched spinach and add it to the walnut paste. Mix in the red wine vinegar. Season with salt. The mixture should be moist enough to hold together when pressed.

4. **Shape:** Form the pkhali mixture into small balls or oval patties, about the size of a walnut. Alternatively, press into a flat round on a serving plate.

5. **Assemble:** Arrange the pkhali on a platter. Drape thin slices of Smoked Sulguni over or alongside each piece. Garnish generously with pomegranate seeds.

6. **Serve:** Serve at room temperature as part of a Georgian appetizer spread, with fresh herbs and shotis puri bread on the side.

### Tips
- Toast walnuts in a dry skillet until fragrant for the best flavor.
- Blue fenugreek (utskho suneli) is the authentic Georgian spice and worth seeking out.
- These can be made a day ahead and refrigerated; bring to room temperature before serving.`,
      prepTime: "25 minutes",
      cookTime: "5 minutes",
      servings: "6",
      difficulty: "Easy",
      imageUrl: "/images/recipes/smoked-sulguni-pkhali.jpg",
    },
    {
      title: "Sulguni-Stuffed Chicken Tabaka",
      slug: "sulguni-stuffed-chicken-tabaka",
      description:
        "A Georgian classic reimagined: crispy, pan-pressed spatchcocked chicken stuffed under the skin with stretchy Sulguni cheese, garlic, and fresh tarragon. The cheese melts into the meat as the chicken cooks, creating an impossibly juicy and flavorful dish.",
      content: `## Sulguni-Stuffed Chicken Tabaka

### Introduction
Chicken tabaka (tsitsila tabaka) is a cornerstone of Georgian home cooking. The bird is spatchcocked and pressed flat under a heavy weight in a skillet, resulting in impossibly crispy skin and juicy meat. In this version, we tuck slices of our Artisanal Sulguni under the skin before cooking, so the cheese melts and bastes the meat from within while the exterior becomes shatteringly crisp.

### Ingredients

- 1 whole chicken (about 1.5kg), spatchcocked
- 200g Colchis Creamery Artisanal Sulguni, sliced 5mm thick
- 4 cloves garlic, minced
- 2 tbsp fresh tarragon, chopped
- 1 tsp ground coriander
- 1/2 tsp black pepper
- 1 tsp sweet paprika
- Salt to taste
- 3 tbsp vegetable oil or clarified butter
- Tkemali (Georgian sour plum sauce) for serving

### Instructions

1. **Prepare the chicken:** Pat the spatchcocked chicken very dry with paper towels. Carefully loosen the skin from the breast and thigh meat by sliding your fingers underneath, being careful not to tear it.

2. **Season and stuff:** Mix the garlic, tarragon, coriander, pepper, and paprika. Rub half of the mixture under the skin. Slide the Sulguni slices under the skin, distributing them evenly across the breast and thighs. Rub the remaining spice mixture over the exterior. Season generously with salt.

3. **Cook:** Heat oil in a large, heavy cast-iron skillet over medium-high heat. Place the chicken skin-side down. Place a heavy lid, another skillet, or a foil-wrapped brick on top to press the chicken flat. Cook for 15-18 minutes until the skin is deep golden and very crispy.

4. **Flip and finish:** Carefully flip the chicken. Replace the weight. Cook for another 12-15 minutes until the internal temperature reaches 74C (165F) at the thickest part of the thigh.

5. **Rest and serve:** Remove from the skillet and rest for 5 minutes. The melted Sulguni will have created pockets of stretchy, savory cheese throughout the meat. Serve with tkemali sauce, fresh herbs, and a simple tomato-cucumber salad.

### Tips
- A heavy cast-iron skillet is essential for proper tabaka.
- Do not move the chicken while it cooks; let the weight do its work.
- The Sulguni should be sliced thin enough to melt fully but thick enough to maintain pockets of cheese.`,
      prepTime: "20 minutes",
      cookTime: "35 minutes",
      servings: "4",
      difficulty: "Intermediate",
      imageUrl: "/images/recipes/sulguni-chicken-tabaka.jpg",
    },
    {
      title: "Aged Reserve and Honey Crostini with Walnuts",
      slug: "aged-reserve-honey-crostini",
      description:
        "An elegant appetizer showcasing the complex, nutty depth of our Aged Colchis Reserve. Thin shavings of the reserve cheese are placed on crispy crostini, drizzled with Georgian mountain honey, and finished with toasted walnuts and a crack of black pepper.",
      content: `## Aged Reserve and Honey Crostini with Walnuts

### Introduction
Sometimes the finest ingredients need only the simplest preparation. This recipe celebrates our Aged Colchis Reserve by pairing it with the timeless Georgian combination of honey and walnuts. The crystalline, nutty complexity of the aged cheese meets floral mountain honey and crunchy toasted walnuts on a crispy bread base. It is the perfect start to a supra or an elegant cheese course.

### Ingredients

- 1 baguette or Georgian shotis puri, sliced on the bias (about 20 slices)
- 3 tbsp extra virgin olive oil
- 200g Colchis Creamery Aged Colchis Reserve
- 100g walnuts, lightly toasted and roughly chopped
- 4 tbsp Georgian mountain honey (or good-quality wildflower honey)
- Flaky sea salt
- Freshly cracked black pepper
- Fresh thyme leaves (optional)

### Instructions

1. **Toast the crostini:** Preheat the oven to 190C (375F). Arrange the bread slices on a baking sheet. Brush lightly with olive oil. Toast for 8-10 minutes until golden and crisp. Let cool slightly.

2. **Prepare the cheese:** Using a sharp knife or vegetable peeler, shave the Aged Colchis Reserve into thin, elegant shards. The cheese should be at cool room temperature for the best flavor and the easiest shaving.

3. **Assemble:** Place generous shavings of cheese onto each crostini. Scatter toasted walnut pieces over the top. Drizzle each crostini with honey, letting it cascade over the edges.

4. **Finish:** Sprinkle with a pinch of flaky sea salt, a crack of black pepper, and a few fresh thyme leaves if desired.

5. **Serve:** Arrange on a platter and serve immediately, while the crostini are still crisp and the honey is glistening.

### Tips
- Bring the cheese to room temperature for the fullest flavor but keep it cool enough to shave cleanly.
- Georgian walnuts are particularly prized; toast them gently to enhance their natural sweetness.
- This pairs beautifully with a glass of aged Saperavi or a semi-sweet Kindzmarauli.`,
      prepTime: "10 minutes",
      cookTime: "10 minutes",
      servings: "4-6",
      difficulty: "Easy",
      imageUrl: "/images/recipes/aged-reserve-crostini.jpg",
    },
  ];

  for (const recipe of recipes) {
    const created = await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: {},
      create: recipe,
    });
    console.log(`Created recipe: ${created.title}`);
  }

  console.log("\nSeeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
