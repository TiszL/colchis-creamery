import type { Recipe } from "@/types";

export const RECIPES: Recipe[] = [
  {
    id: "1",
    title: "Classic Georgian Khachapuri",
    slug: "classic-georgian-khachapuri",
    description:
      "The iconic Georgian cheese bread, made with our Imeretian cheese. A crispy boat of dough filled with molten cheese, butter, and a runny egg.",
    content: `## Classic Georgian Khachapuri (Adjarian Style)

This is the most famous Georgian dish — a boat-shaped bread overflowing with melted cheese, crowned with butter and a soft egg. Using authentic Colchis Creamery Imeretian cheese makes all the difference.

### Ingredients
- 1 lb Colchis Creamery Imeretian Cheese, crumbled
- 4 oz Colchis Creamery Artisanal Sulguni, shredded
- 2 cups all-purpose flour
- 1 cup warm water
- 1 tsp active dry yeast
- 1 tsp sugar
- 1 tsp salt
- 2 tbsp olive oil
- 2 eggs (1 for filling, 1 for egg wash)
- 3 tbsp butter

### Instructions
1. Dissolve yeast and sugar in warm water. Let sit 5 minutes until foamy.
2. Mix flour and salt. Add yeast mixture and olive oil. Knead until smooth, about 8 minutes.
3. Cover and let rise 1 hour until doubled.
4. Mix crumbled Imeretian cheese with shredded Sulguni and 1 beaten egg.
5. Divide dough into 4 portions. Roll each into an oval shape.
6. Place cheese mixture in the center, fold edges up to create a boat shape, pinching ends.
7. Bake at 475°F (245°C) for 12-15 minutes until golden.
8. Remove from oven, make a well in the cheese, add a pat of butter and a raw egg.
9. Return to oven for 2-3 minutes until egg white is just set.
10. Stir egg and butter into the hot cheese. Serve immediately.

### Chef's Tips
- The cheese should be at room temperature for best melting.
- Don't overbake — the egg should still be runny.
- Tear pieces of the bread boat to scoop up the molten cheese.`,
    prepTime: "20 minutes",
    cookTime: "15 minutes",
    servings: "4",
    difficulty: "Medium",
    imageUrl: "/images/recipes/khachapuri.jpg",
    isPublished: true,
  },
  {
    id: "2",
    title: "Smoked Sulguni Gourmet Burger",
    slug: "smoked-sulguni-gourmet-burger",
    description:
      "Elevate your burger game with our Smoked Sulguni. The smoky, elastic cheese melts beautifully and adds an unforgettable depth of flavor.",
    content: `## Smoked Sulguni Gourmet Burger

Take your homemade burgers from ordinary to extraordinary with the rich, smoky flavor of Colchis Creamery Smoked Sulguni.

### Ingredients
- 4 oz Colchis Creamery Smoked Sulguni, sliced
- 1 lb ground beef (80/20)
- 4 brioche buns
- 1 red onion, sliced into rings
- 4 leaves butter lettuce
- 2 tbsp mayonnaise
- 1 tbsp Dijon mustard
- Salt and pepper to taste

### Instructions
1. Form ground beef into 4 patties, slightly larger than your buns. Season generously.
2. Grill or pan-sear patties over high heat, 4 minutes per side for medium.
3. During the last minute, top each patty with a slice of Smoked Sulguni and cover to melt.
4. Toast buns lightly on the grill.
5. Mix mayo and Dijon for the sauce.
6. Assemble: bun, sauce, lettuce, cheesy patty, onion rings, top bun.

### Chef's Tips
- The Smoked Sulguni's elastic texture means it melts into stretchy, gooey perfection.
- Try caramelizing the onion rings for extra sweetness.`,
    prepTime: "10 minutes",
    cookTime: "10 minutes",
    servings: "4",
    difficulty: "Easy",
    imageUrl: "/images/recipes/sulguni-burger.jpg",
    isPublished: true,
  },
  {
    id: "3",
    title: "Georgian Cheese & Walnut Salad",
    slug: "georgian-cheese-walnut-salad",
    description:
      "A refreshing salad combining our Imeretian cheese with toasted walnuts, fresh herbs, and a pomegranate dressing — a taste of Georgian hospitality.",
    content: `## Georgian Cheese & Walnut Salad

This elegant salad showcases the fresh, mild flavor of Imeretian cheese paired with the richness of walnuts and the brightness of pomegranate.

### Ingredients
- 8 oz Colchis Creamery Imeretian Cheese, cubed
- 1 cup walnuts, toasted
- 1 cup pomegranate seeds
- 4 cups mixed greens (arugula and spinach)
- 1 cucumber, diced
- Fresh cilantro and basil
- 3 tbsp pomegranate molasses
- 2 tbsp extra virgin olive oil
- 1 tbsp red wine vinegar
- Salt and pepper

### Instructions
1. Toast walnuts in a dry pan until fragrant, about 5 minutes. Roughly chop.
2. Whisk together pomegranate molasses, olive oil, and vinegar for the dressing.
3. Arrange mixed greens on a platter.
4. Top with cubed Imeretian cheese, cucumber, walnuts, and pomegranate seeds.
5. Drizzle with dressing. Garnish with fresh herbs.

### Chef's Tips
- The mild saltiness of Imeretian cheese balances the sweet-tart dressing.
- Add grilled chicken for a complete meal.`,
    prepTime: "15 minutes",
    cookTime: "5 minutes",
    servings: "4",
    difficulty: "Easy",
    imageUrl: "/images/recipes/cheese-walnut-salad.jpg",
    isPublished: true,
  },
];

export function getRecipe(slug: string): Recipe | undefined {
  return RECIPES.find((r) => r.slug === slug);
}

export function getPublishedRecipes(): Recipe[] {
  return RECIPES.filter((r) => r.isPublished);
}
