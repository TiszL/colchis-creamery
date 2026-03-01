

export function JsonLdRecipe({ recipe }: { recipe: any }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.excerpt,
    image: recipe.coverImage,
    author: {
      "@type": "Organization",
      name: recipe.author,
    },
    prepTime: recipe.preparationTime,
    cookTime: recipe.cookingTime,
    recipeYield: recipe.yield,
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.instructions.map((step: string) => ({
      "@type": "HowToStep",
      text: step,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
