import type { Ingredient, RecipeFacts } from "@cookbook/shared";

export type PrototypeStepIngredient = {
  label: string;
};

export type PrototypeStepTimer = {
  id: string;
  label: string;
  durationSeconds: number;
};

export type PrototypeStep = {
  text: string;
  ingredients: PrototypeStepIngredient[];
  timers?: PrototypeStepTimer[];
};

export type PrototypeRecipe = {
  id: string;
  title: string;
  shortTitle: string;
  imageUrl?: string;
  servings: number;
  ingredients: Ingredient[];
  steps: PrototypeStep[];
  facts: RecipeFacts;
};

type RawPrototypeRecipe = Omit<PrototypeRecipe, "shortTitle" | "imageUrl">;

const CARD_META: Record<string, { shortTitle: string; imageUrl?: string }> = {
  "duck-breast-cherry-reduction": {
    shortTitle: "Duck & Cherry Glaze",
    imageUrl: "/images/meals/duck-breast-cherry-reduction.jpg",
  },
  "three-hour-beef-barley-stew": {
    shortTitle: "Beef & Barley Stew",
    imageUrl: "/images/meals/three-hour-beef-barley-stew.jpg",
  },
  "lemon-garlic-chicken-thighs": {
    shortTitle: "Lemon-Garlic Chicken",
    imageUrl: "/images/meals/lemon-garlic-chicken-thighs.jpg",
  },
  "long-title-chickpea-cabbage-braise": {
    shortTitle: "Chickpea Cabbage Braise",
    imageUrl: "/images/meals/long-title-chickpea-cabbage-braise.jpg",
  },
  "flash-seared-scallops-pasta": {
    shortTitle: "Seared Scallops Pasta",
  },
  "oaxacan-chicken-mole-20-ingredients": {
    shortTitle: "Oaxacan Chicken Mole",
    imageUrl: "/images/meals/oaxacan-chicken-mole-20-ingredients.jpg",
  },
  "jammy-eggs-ricotta-toast": {
    shortTitle: "Jammy Egg Toast",
  },
  "mystery-pantry-noodle-soup": {
    shortTitle: "Pantry Noodle Soup",
    imageUrl: "/images/meals/mystery-pantry-noodle-soup.jpg",
  },
  "warm-farro-squash-salad": {
    shortTitle: "Warm Farro & Squash",
  },
  "cast-iron-pork-chops": {
    shortTitle: "Cast-Iron Pork Chops",
    imageUrl: "/images/meals/cast-iron-pork-chops.jpg",
  },
  "charred-broccoli-polenta-bowls": {
    shortTitle: "Broccoli Polenta Bowl",
  },
  "maple-seitan-skewers": {
    shortTitle: "Maple Seitan Skewers",
  },
  "herb-crusted-rack-of-lamb": {
    shortTitle: "Herb Rack of Lamb",
  },
  "tofu-banh-mi-bowls": {
    shortTitle: "Tofu Banh Mi Bowls",
    imageUrl: "/images/meals/tofu-banh-mi-bowls.jpg",
  },
  "pan-roasted-cod-fennel": {
    shortTitle: "Pan-Roasted Cod",
  },
  "miso-salmon-parcels": {
    shortTitle: "Miso Salmon Parcels",
  },
  "garlic-butter-shrimp-skillet": {
    shortTitle: "Garlic Shrimp Skillet",
    imageUrl: "/images/meals/garlic-butter-shrimp-skillet.jpg",
  },
  "ginger-scallion-ground-chicken-cups": {
    shortTitle: "Ginger Chicken Cups",
  },
  "roasted-turkey-breast-gravy": {
    shortTitle: "Roast Turkey & Gravy",
  },
  "cardamom-orange-overnight-oats": {
    shortTitle: "Cardamom Overnight Oats",
  },
  "laminated-rosemary-brioche-galette": {
    shortTitle: "Rosemary Brioche Tart",
  },
  "crispy-smoked-paprika-chickpeas": {
    shortTitle: "Smoky Crisp Chickpeas",
  },
  "burnt-basque-cheesecake": {
    shortTitle: "Basque Cheesecake",
  },
  "poached-pears-hibiscus": {
    shortTitle: "Hibiscus Poached Pears",
    imageUrl: "/images/meals/poached-pears-hibiscus.jpg",
  },
  "skillet-white-beans-sweet-paprika": {
    shortTitle: "Skillet White Beans",
  },
};

function ing(line: string, name?: string): Ingredient {
  return {
    line,
    amount: null,
    unit: "",
    name: name ?? line,
  };
}

const RAW_SAMPLE_RECIPES: RawPrototypeRecipe[] = [
  {
    id: "duck-breast-cherry-reduction",
    title: "Crispy-Skin Duck Breast with Cherry Reduction and Roasted Potatoes",
    servings: 2,
    facts: {
      primaryProtein: "duck",
      totalMinutes: 45,
      effort: "high",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("2 boneless duck breasts (about 12 oz total), skin scored", "duck breast"),
      ing("1 lb baby Yukon Gold potatoes, halved", "Yukon Gold potatoes"),
      ing("1 tbsp olive oil", "olive oil"),
      ing("1 cup frozen or fresh pitted dark cherries", "dark cherries"),
      ing("1/2 cup dry red wine", "red wine"),
      ing("1/2 cup chicken stock", "chicken stock"),
      ing("1 shallot, finely minced", "shallot"),
      ing("2 sprigs fresh thyme", "thyme"),
      ing("1 tbsp cold unsalted butter", "unsalted butter"),
      ing("1 tsp kosher salt, divided", "kosher salt"),
      ing("1/2 tsp freshly cracked black pepper", "black pepper"),
    ],
    steps: [
      {
        text: "Heat oven to 425°F. Toss halved potatoes with olive oil, half the kosher salt, and black pepper on a sheet pan, cut-side down. Roast until crisp and golden.",
        ingredients: [
          { label: "1 lb baby Yukon Gold potatoes, halved" },
          { label: "1 tbsp olive oil" },
          { label: "1/2 tsp kosher salt" },
          { label: "1/2 tsp freshly cracked black pepper" },
        ],
        timers: [
          {
            id: "roast-potatoes",
            label: "Roast potatoes",
            durationSeconds: 25 * 60,
          },
        ],
      },
      {
        text: "Season duck breasts with remaining kosher salt. Place skin-side down in a cold heavy skillet, then set over medium-low heat to slowly render fat and crisp the skin without flipping.",
        ingredients: [
          { label: "2 boneless duck breasts, skin scored" },
          { label: "1/2 tsp kosher salt" },
        ],
        timers: [
          {
            id: "render-duck",
            label: "Render duck skin",
            durationSeconds: 10 * 60,
          },
        ],
      },
      {
        text: "Pour off most of the rendered duck fat (save it!), flip breasts flesh-side down for 2 minutes until medium-rare (130°F), then transfer to a warm plate to rest.",
        ingredients: [{ label: "2 boneless duck breasts" }],
        timers: [
          {
            id: "sear-flesh",
            label: "Sear duck flesh",
            durationSeconds: 2 * 60,
          },
          {
            id: "rest-duck",
            label: "Rest duck breast",
            durationSeconds: 6 * 60,
          },
        ],
      },
      {
        text: "While the duck rests and potatoes finish roasting, sauté minced shallot in 1 tsp remaining pan fat for 1 minute. Add cherries, red wine, chicken stock, and thyme; simmer briskly until reduced by half.",
        ingredients: [
          { label: "1 shallot, finely minced" },
          { label: "1 cup pitted dark cherries" },
          { label: "1/2 cup dry red wine" },
          { label: "1/2 cup chicken stock" },
          { label: "2 sprigs fresh thyme" },
        ],
        timers: [
          {
            id: "cherry-reduction",
            label: "Simmer cherry reduction",
            durationSeconds: 6 * 60,
          },
        ],
      },
      {
        text: "Swirl cold butter off-heat into the cherry sauce until glossy. Slice duck on the bias and serve alongside the roasted potatoes.",
        ingredients: [{ label: "1 tbsp cold unsalted butter" }],
      },
    ],
  },
  {
    id: "three-hour-beef-barley-stew",
    title: "Three-Hour Hearthside Beef and Barley Stew",
    servings: 6,
    facts: {
      primaryProtein: "beef",
      totalMinutes: 180,
      effort: "low",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("2 lbs beef chuck, cut into 1.5-inch cubes", "beef chuck"),
      ing("2 tbsp neutral oil", "neutral oil"),
      ing("1 large yellow onion, diced", "yellow onion"),
      ing("3 carrots, cut into thick coins", "carrots"),
      ing("2 stalks celery, sliced", "celery"),
      ing("4 cloves garlic, smashed", "garlic"),
      ing("2 tbsp tomato paste", "tomato paste"),
      ing("6 cups beef broth", "beef broth"),
      ing("3/4 cup pearl barley, rinsed", "pearl barley"),
      ing("2 bay leaves", "bay leaves"),
      ing("1 tbsp Worcestershire sauce", "Worcestershire sauce"),
      ing("1.5 tsp kosher salt", "kosher salt"),
    ],
    steps: [
      {
        text: "Heat oil in a Dutch oven over medium-high heat. Pat beef dry, season with salt, and sear in two batches until deeply browned on at least two sides.",
        ingredients: [
          { label: "2 lbs beef chuck, cubed" },
          { label: "2 tbsp neutral oil" },
          { label: "1.5 tsp kosher salt" },
        ],
        timers: [
          {
            id: "sear-beef",
            label: "Brown beef batches",
            durationSeconds: 8 * 60,
          },
        ],
      },
      {
        text: "Lower heat to medium. Stir in onion, carrots, celery, and garlic; cook until softened and fragrant, then stir in tomato paste for 1 minute.",
        ingredients: [
          { label: "1 large yellow onion, diced" },
          { label: "3 carrots, sliced" },
          { label: "2 stalks celery, sliced" },
          { label: "4 cloves garlic, smashed" },
          { label: "2 tbsp tomato paste" },
        ],
        timers: [
          {
            id: "sweat-mirepoix",
            label: "Soften vegetables",
            durationSeconds: 6 * 60,
          },
        ],
      },
      {
        text: "Pour in beef broth, Worcestershire sauce, and bay leaves. Return beef and juices to the pot, cover tightly, and simmer gently in a 300°F oven for 2 hours.",
        ingredients: [
          { label: "6 cups beef broth" },
          { label: "1 tbsp Worcestershire sauce" },
          { label: "2 bay leaves" },
        ],
        timers: [
          {
            id: "braise-stew",
            label: "Oven braise beef",
            durationSeconds: 120 * 60,
          },
        ],
      },
      {
        text: "Stir in rinsed pearl barley, cover, and continue braising until barley is plump and beef yields to a spoon.",
        ingredients: [{ label: "3/4 cup pearl barley, rinsed" }],
        timers: [
          {
            id: "simmer-barley",
            label: "Cook pearl barley",
            durationSeconds: 35 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "lemon-garlic-chicken-thighs",
    title: "Weeknight Lemon-Garlic Chicken Thighs with Crispy Shallots",
    servings: 4,
    facts: {
      primaryProtein: "chicken",
      totalMinutes: 40,
      effort: "low",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("6 bone-in skin-on chicken thighs", "bone-in chicken thighs"),
      ing("2 tbsp olive oil", "olive oil"),
      ing("3 shallots, thinly sliced into rings", "shallots"),
      ing("5 cloves garlic, lightly crushed", "garlic"),
      ing("1 lemon, thinly sliced", "lemon"),
      ing("1/2 cup dry white wine", "white wine"),
      ing("1 tsp dried oregano", "dried oregano"),
      ing("1 tsp kosher salt", "kosher salt"),
    ],
    steps: [
      {
        text: "Season chicken thighs all over with kosher salt and dried oregano. Place skin-side down in an oven-safe skillet with 1 tbsp olive oil over medium heat until skin is deeply crisp.",
        ingredients: [
          { label: "6 bone-in skin-on chicken thighs" },
          { label: "1 tbsp olive oil" },
          { label: "1 tsp kosher salt" },
          { label: "1 tsp dried oregano" },
        ],
        timers: [
          {
            id: "crisp-thigh-skin",
            label: "Crisp chicken skin",
            durationSeconds: 7 * 60,
          },
        ],
      },
      {
        text: "While chicken renders, heat remaining 1 tbsp olive oil in a small pan and fry sliced shallots until golden crisp; drain on a paper towel.",
        ingredients: [
          { label: "3 shallots, thinly sliced" },
          { label: "1 tbsp olive oil" },
        ],
        timers: [
          {
            id: "fry-shallots",
            label: "Crisp shallots",
            durationSeconds: 3 * 60,
          },
        ],
      },
      {
        text: "Flip chicken thighs, tuck crushed garlic cloves and lemon slices around them, pour in white wine, and transfer skillet to a 425°F oven until cooked through.",
        ingredients: [
          { label: "5 cloves garlic, lightly crushed" },
          { label: "1 lemon, thinly sliced" },
          { label: "1/2 cup dry white wine" },
        ],
        timers: [
          {
            id: "bake-thighs",
            label: "Roast chicken thighs",
            durationSeconds: 15 * 60,
          },
        ],
      },
      {
        text: "Top thighs with crispy shallots and spoon pan juices over before serving.",
        ingredients: [{ label: "Crispy shallots (from step 2)" }],
      },
    ],
  },
  {
    id: "long-title-chickpea-cabbage-braise",
    title:
      "Slow-Simmered Calabrian Chili Chickpea and Charred Cabbage Braise with Crispy Garlic Breadcrumbs and Lemon Herb Yogurt",
    servings: 4,
    facts: {
      primaryProtein: "beans/lentils",
      totalMinutes: 65,
      effort: "medium",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("1 medium green cabbage, cut into 6 wedges", "green cabbage"),
      ing("2 cans (15 oz each) chickpeas, drained and rinsed", "chickpeas"),
      ing("3 tbsp olive oil, divided", "olive oil"),
      ing("2 tbsp Calabrian chili paste", "Calabrian chili paste"),
      ing("4 cloves garlic, finely grated", "garlic"),
      ing("1 cup coarse sourdough breadcrumbs", "sourdough breadcrumbs"),
      ing("1.5 cups vegetable broth", "vegetable broth"),
      ing("3/4 cup plain Greek yogurt", "Greek yogurt"),
      ing("1 lemon, zested and juiced", "lemon"),
      ing("1/4 cup chopped fresh dill", "fresh dill"),
    ],
    steps: [
      {
        text: "Sear cabbage wedges in 2 tbsp olive oil in a wide Dutch oven until deeply charred on cut sides, about 4 minutes per side.",
        ingredients: [
          { label: "1 medium green cabbage, in 6 wedges" },
          { label: "2 tbsp olive oil" },
        ],
        timers: [
          {
            id: "char-cabbage",
            label: "Char cabbage wedges",
            durationSeconds: 8 * 60,
          },
        ],
      },
      {
        text: "In a small skillet, toast breadcrumbs with remaining 1 tbsp olive oil and half the grated garlic until crunchy and golden.",
        ingredients: [
          { label: "1 cup coarse sourdough breadcrumbs" },
          { label: "1 tbsp olive oil" },
          { label: "2 cloves garlic, grated" },
        ],
        timers: [
          {
            id: "toast-crumbs",
            label: "Toast garlic crumbs",
            durationSeconds: 4 * 60,
          },
        ],
      },
      {
        text: "Add chickpeas, Calabrian chili paste, remaining garlic, and vegetable broth around the cabbage. Cover and braise gently until cabbage cores are tender.",
        ingredients: [
          { label: "2 cans chickpeas, drained" },
          { label: "2 tbsp Calabrian chili paste" },
          { label: "2 cloves garlic, grated" },
          { label: "1.5 cups vegetable broth" },
        ],
        timers: [
          {
            id: "braise-cabbage",
            label: "Braise cabbage & chickpeas",
            durationSeconds: 25 * 60,
          },
        ],
      },
      {
        text: "Whisk Greek yogurt with lemon zest, lemon juice, and fresh dill. Spoon yogurt onto warm bowls, ladle over cabbage and chickpeas, and crown with garlic breadcrumbs.",
        ingredients: [
          { label: "3/4 cup plain Greek yogurt" },
          { label: "1 lemon, zested and juiced" },
          { label: "1/4 cup chopped fresh dill" },
        ],
      },
    ],
  },
  {
    id: "flash-seared-scallops-pasta",
    title: "Flash-Seared Scallops with Hand-Torn Herb Pasta and Brown Butter",
    servings: 2,
    facts: {
      primaryProtein: "shellfish",
      totalMinutes: 20,
      effort: "high",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("10 dry-pack sea scallops, side muscle removed", "sea scallops"),
      ing("8 oz fresh pasta sheets, torn into ribbons", "fresh pasta"),
      ing("3 tbsp unsalted butter", "unsalted butter"),
      ing("1 tbsp high-heat neutral oil", "neutral oil"),
      ing("1 tbsp fresh sage leaves", "sage leaves"),
      ing("1/2 lemon, juiced", "lemon"),
      ing("1 tsp flaky sea salt", "sea salt"),
    ],
    steps: [
      {
        text: "Bring a pot of salted water to a rolling boil for the torn pasta sheets.",
        ingredients: [{ label: "8 oz fresh pasta sheets, torn" }],
        timers: [
          {
            id: "boil-pasta",
            label: "Cook fresh pasta",
            durationSeconds: 3 * 60,
          },
        ],
      },
      {
        text: "Pat scallops bone-dry. Heat neutral oil in stainless steel until shimmering, sear scallops 90 seconds undisturbed until golden crust forms, then flip for 45 seconds.",
        ingredients: [
          { label: "10 dry-pack sea scallops" },
          { label: "1 tbsp neutral oil" },
          { label: "1 tsp flaky sea salt" },
        ],
        timers: [
          {
            id: "sear-scallops-1",
            label: "Scallops first side",
            durationSeconds: 90,
          },
        ],
      },
      {
        text: "Transfer scallops to a warm plate. Drop heat to medium, melt butter with sage leaves until nutty brown foam smells like toasted hazelnuts, and squeeze in lemon juice.",
        ingredients: [
          { label: "3 tbsp unsalted butter" },
          { label: "1 tbsp fresh sage leaves" },
          { label: "1/2 lemon, juiced" },
        ],
        timers: [
          {
            id: "brown-butter",
            label: "Brown butter",
            durationSeconds: 90,
          },
        ],
      },
      {
        text: "Toss drained pasta through the sage brown butter with a splash of pasta water, plate immediately, and nestle scallops on top.",
        ingredients: [{ label: "Drained pasta + 2 tbsp pasta water" }],
      },
    ],
  },
  {
    id: "oaxacan-chicken-mole-20-ingredients",
    title: "Oaxacan-Style Chicken Thigh Mole Negro with Toasted Sesame",
    servings: 6,
    facts: {
      primaryProtein: "chicken",
      totalMinutes: 95,
      effort: "high",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("8 bone-in chicken thighs", "bone-in chicken thighs"),
      ing("3 dried ancho chiles, stemmed and seeded", "ancho chiles"),
      ing("3 dried pasilla chiles, stemmed and seeded", "pasilla chiles"),
      ing("2 dried mulato chiles, stemmed and seeded", "mulato chiles"),
      ing("3 tbsp sesame seeds, divided", "sesame seeds"),
      ing("1/4 cup raw almonds", "almonds"),
      ing("1/4 cup raw pumpkin seeds (pepitas)", "pepitas"),
      ing("2 tbsp raisins", "raisins"),
      ing("1 ripe plantain, sliced", "plantain"),
      ing("1 corn tortilla, torn", "corn tortilla"),
      ing("3 Roma tomatoes, halved", "Roma tomatoes"),
      ing("1/2 white onion, quartered", "white onion"),
      ing("4 cloves garlic, unpeeled", "garlic"),
      ing("1/2 tsp Mexican cinnamon (canela)", "cinnamon"),
      ing("1/4 tsp whole cloves", "cloves"),
      ing("1/2 tsp dried Mexican oregano", "oregano"),
      ing("4 cups chicken stock", "chicken stock"),
      ing("1.5 oz Mexican dark chocolate, chopped", "dark chocolate"),
      ing("2 tbsp lard or neutral oil", "neutral oil"),
      ing("1.5 tsp kosher salt", "kosher salt"),
    ],
    steps: [
      {
        text: "Toast dried ancho, pasilla, and mulato chiles on a dry comal until fragrant and pliable, pressing lightly for 15 seconds per side, then soak in hot water.",
        ingredients: [
          { label: "3 dried ancho chiles" },
          { label: "3 dried pasilla chiles" },
          { label: "2 dried mulato chiles" },
        ],
        timers: [
          {
            id: "soak-chiles",
            label: "Soak toasted chiles",
            durationSeconds: 15 * 60,
          },
        ],
      },
      {
        text: "On the same dry skillet, char halved tomatoes, onion quarters, and unpeeled garlic cloves until blistered.",
        ingredients: [
          { label: "3 Roma tomatoes, halved" },
          { label: "1/2 white onion, quartered" },
          { label: "4 cloves garlic, unpeeled" },
        ],
        timers: [
          {
            id: "char-veg",
            label: "Blister tomatoes & onion",
            durationSeconds: 10 * 60,
          },
        ],
      },
      {
        text: "Toast sesame seeds, almonds, pepitas, cinnamon, cloves, and oregano in a dry pan until golden and aromatic (reserve 1 tbsp sesame seeds for garnish).",
        ingredients: [
          { label: "3 tbsp sesame seeds (reserve 1 tbsp)" },
          { label: "1/4 cup raw almonds" },
          { label: "1/4 cup pepitas" },
          { label: "1/2 tsp cinnamon" },
          { label: "1/4 tsp whole cloves" },
          { label: "1/2 tsp dried oregano" },
        ],
      },
      {
        text: "Fry sliced plantain, raisins, and torn corn tortilla in 1 tbsp oil until browned. Blend soaked chiles, charred vegetables, toasted nuts/spices, and fried plantain mixture with 2 cups chicken stock until silky smooth.",
        ingredients: [
          { label: "1 ripe plantain, sliced" },
          { label: "2 tbsp raisins" },
          { label: "1 corn tortilla, torn" },
          { label: "1 tbsp neutral oil" },
          { label: "2 cups chicken stock" },
        ],
      },
      {
        text: "Heat remaining 1 tbsp oil in a Dutch oven, fry the mole puree for 5 minutes while stirring constantly, then thin with remaining 2 cups chicken stock.",
        ingredients: [
          { label: "1 tbsp neutral oil" },
          { label: "2 cups chicken stock" },
        ],
      },
      {
        text: "Season chicken thighs with kosher salt, nestle into the simmering mole sauce, cover partially, and cook gently until tender.",
        ingredients: [
          { label: "8 bone-in chicken thighs" },
          { label: "1.5 tsp kosher salt" },
        ],
        timers: [
          {
            id: "simmer-mole",
            label: "Simmer chicken in mole",
            durationSeconds: 35 * 60,
          },
        ],
      },
      {
        text: "Stir in chopped dark chocolate until melted and glossy; scatter reserved toasted sesame seeds on top.",
        ingredients: [
          { label: "1.5 oz Mexican dark chocolate" },
          { label: "1 tbsp reserved toasted sesame seeds" },
        ],
      },
    ],
  },
  {
    id: "jammy-eggs-ricotta-toast",
    title: "6-Minute Jammy Eggs with Whipped Ricotta Toast",
    servings: 2,
    facts: {
      primaryProtein: "eggs",
      totalMinutes: 12,
      effort: "low",
      mealTypes: ["breakfast", "snack"],
    },
    ingredients: [
      ing("4 large eggs, straight from the fridge", "eggs"),
      ing("2 thick slices sourdough bread", "sourdough bread"),
      ing("1/2 cup whole-milk ricotta", "ricotta"),
      ing("1 tbsp olive oil", "olive oil"),
      ing("1 tsp lemon zest", "lemon zest"),
      ing("1/2 tsp chili flakes", "chili flakes"),
      ing("1/2 tsp flaky sea salt", "sea salt"),
    ],
    steps: [
      {
        text: "Lower cold eggs gently into gently boiling water and set the timer for jammy yolks.",
        ingredients: [{ label: "4 large cold eggs" }],
        timers: [
          {
            id: "boil-jammy-eggs",
            label: "Jammy eggs",
            durationSeconds: 6 * 60,
          },
        ],
      },
      {
        text: "Meanwhile, whip ricotta with olive oil and lemon zest until airy (try the 45-second timer!), and toast sourdough slices until crisp.",
        ingredients: [
          { label: "1/2 cup whole-milk ricotta" },
          { label: "1 tbsp olive oil" },
          { label: "1 tsp lemon zest" },
          { label: "2 slices sourdough bread" },
        ],
        timers: [
          {
            id: "whip-ricotta",
            label: "Whip ricotta",
            durationSeconds: 45,
          },
          {
            id: "toast-sourdough",
            label: "Toast sourdough",
            durationSeconds: 3 * 60,
          },
        ],
      },
      {
        text: "Shock eggs in ice water for 1 minute, peel, halve over ricotta toast, and finish with chili flakes and sea salt.",
        ingredients: [
          { label: "1/2 tsp chili flakes" },
          { label: "1/2 tsp flaky sea salt" },
        ],
      },
    ],
  },
  {
    id: "mystery-pantry-noodle-soup",
    title: "Grandma's Mystery Pantry Noodle Soup",
    servings: 3,
    facts: {
      primaryProtein: null,
      totalMinutes: null,
      effort: null,
      mealTypes: [],
    },
    ingredients: [
      ing("6 oz dried wheat noodles", "wheat noodles"),
      ing("4 cups vegetable or mushroom broth", "vegetable broth"),
      ing("2 scallions, sliced", "scallions"),
      ing("1 tbsp soy sauce", "soy sauce"),
      ing("1 tsp toasted sesame oil", "sesame oil"),
    ],
    steps: [
      {
        text: "Bring broth and soy sauce to a simmer in a saucepan.",
        ingredients: [
          { label: "4 cups broth" },
          { label: "1 tbsp soy sauce" },
        ],
      },
      {
        text: "Boil noodles directly in the broth until tender, then finish with scallions and sesame oil.",
        ingredients: [
          { label: "6 oz dried wheat noodles" },
          { label: "2 scallions, sliced" },
          { label: "1 tsp toasted sesame oil" },
        ],
        timers: [
          {
            id: "cook-noodles",
            label: "Simmer noodles",
            durationSeconds: 5 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "warm-farro-squash-salad",
    title: "Warm Farro Salad with Roasted Squash and Pepitas",
    servings: 4,
    facts: {
      primaryProtein: null,
      totalMinutes: null,
      effort: "low",
      mealTypes: ["lunch", "dinner"],
    },
    ingredients: [
      ing("1 cup semi-pearled farro", "farro"),
      ing("1 small delicata squash, sliced into half-moons", "delicata squash"),
      ing("1/3 cup toasted pepitas", "pepitas"),
      ing("3 cups baby arugula", "arugula"),
      ing("2 tbsp apple cider vinaigrette", "vinaigrette"),
    ],
    steps: [
      {
        text: "Simmer farro in salted water until chewy-tender, about 25 minutes; drain well.",
        ingredients: [{ label: "1 cup semi-pearled farro" }],
        timers: [
          {
            id: "simmer-farro",
            label: "Simmer farro",
            durationSeconds: 25 * 60,
          },
        ],
      },
      {
        text: "Roast delicata squash slices at 425°F until caramelized at the edges.",
        ingredients: [{ label: "1 small delicata squash, sliced" }],
        timers: [
          {
            id: "roast-squash",
            label: "Roast squash",
            durationSeconds: 20 * 60,
          },
        ],
      },
      {
        text: "Toss warm farro and roasted squash with arugula, pepitas, and vinaigrette.",
        ingredients: [
          { label: "3 cups baby arugula" },
          { label: "1/3 cup toasted pepitas" },
          { label: "2 tbsp apple cider vinaigrette" },
        ],
      },
    ],
  },
  {
    id: "cast-iron-pork-chops",
    title: "Cast-Iron Pork Chops with Apple Cider Pan Glaze",
    servings: 2,
    facts: {
      primaryProtein: "pork",
      totalMinutes: 35,
      effort: null,
      mealTypes: [],
    },
    ingredients: [
      ing("2 thick-cut bone-in pork chops", "pork chops"),
      ing("1 Honeycrisp apple, sliced", "apple"),
      ing("1/2 cup apple cider", "apple cider"),
      ing("1 tbsp Dijon mustard", "Dijon mustard"),
      ing("1 tbsp neutral oil", "neutral oil"),
      ing("1 tsp kosher salt", "kosher salt"),
    ],
    steps: [
      {
        text: "Pat pork chops dry and season with kosher salt. Sear in hot cast iron with neutral oil until deeply browned.",
        ingredients: [
          { label: "2 thick-cut bone-in pork chops" },
          { label: "1 tbsp neutral oil" },
          { label: "1 tsp kosher salt" },
        ],
        timers: [
          {
            id: "sear-pork",
            label: "Sear pork chops",
            durationSeconds: 5 * 60,
          },
        ],
      },
      {
        text: "Flip chops, scatter apple slices around them, and pour in apple cider and Dijon mustard; simmer until glaze coats the back of a spoon.",
        ingredients: [
          { label: "1 Honeycrisp apple, sliced" },
          { label: "1/2 cup apple cider" },
          { label: "1 tbsp Dijon mustard" },
        ],
      },
    ],
  },
  {
    id: "charred-broccoli-polenta-bowls",
    title: "Charred Broccoli and Crispy Polenta Bowls with Salsa Verde",
    servings: 4,
    facts: {
      primaryProtein: null,
      totalMinutes: 35,
      effort: "low",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("1 lb broccoli florets", "broccoli"),
      ing("1 cup coarse cornmeal polenta", "polenta"),
      ing("2 tbsp olive oil", "olive oil"),
      ing("1/3 cup herb salsa verde", "salsa verde"),
      ing("1 tsp kosher salt", "kosher salt"),
    ],
    steps: [
      {
        text: "Roast broccoli florets tossed in olive oil and kosher salt at 450°F until crisp-charred.",
        ingredients: [
          { label: "1 lb broccoli florets" },
          { label: "2 tbsp olive oil" },
          { label: "1 tsp kosher salt" },
        ],
        timers: [
          {
            id: "roast-broccoli",
            label: "Roast broccoli",
            durationSeconds: 18 * 60,
          },
        ],
      },
      {
        text: "Whisk polenta into 4 cups boiling salted water and simmer, stirring often, until creamy.",
        ingredients: [{ label: "1 cup coarse cornmeal polenta" }],
      },
      {
        text: "Spoon polenta into bowls, top with charred broccoli, and drizzle generously with salsa verde.",
        ingredients: [{ label: "1/3 cup herb salsa verde" }],
      },
    ],
  },
  {
    id: "maple-seitan-skewers",
    title: "Smoky Maple-Glazed Seitan Skewers with Sesame Slaw",
    servings: 3,
    facts: {
      primaryProtein: "seitan",
      totalMinutes: 30,
      effort: "medium",
      mealTypes: ["lunch", "dinner"],
    },
    ingredients: [
      ing("12 oz wheat seitan strips, cubed", "seitan"),
      ing("2 tbsp pure maple syrup", "maple syrup"),
      ing("1 tbsp tamari", "tamari"),
      ing("1 tsp smoked paprika", "smoked paprika"),
      ing("3 cups shredded green cabbage", "green cabbage"),
      ing("1 tbsp toasted sesame oil", "sesame oil"),
    ],
    steps: [
      {
        text: "Whisk maple syrup, tamari, and smoked paprika; toss seitan cubes in half the glaze and thread onto skewers.",
        ingredients: [
          { label: "12 oz wheat seitan cubes" },
          { label: "2 tbsp maple syrup" },
          { label: "1 tbsp tamari" },
          { label: "1 tsp smoked paprika" },
        ],
      },
      {
        text: "Broil or grill skewers until caramelized on the edges, brushing with remaining glaze.",
        ingredients: [{ label: "Remaining maple glaze" }],
        timers: [
          {
            id: "broil-seitan",
            label: "Broil seitan skewers",
            durationSeconds: 8 * 60,
          },
        ],
      },
      {
        text: "Toss shredded cabbage with toasted sesame oil and serve alongside skewers.",
        ingredients: [
          { label: "3 cups shredded green cabbage" },
          { label: "1 tbsp toasted sesame oil" },
        ],
      },
    ],
  },
  {
    id: "herb-crusted-rack-of-lamb",
    title: "Herb-Crusted Rack of Lamb with Mint Gremolata",
    servings: 4,
    facts: {
      primaryProtein: "lamb",
      totalMinutes: 55,
      effort: "high",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("2 frenched racks of lamb", "rack of lamb"),
      ing("2 tbsp Dijon mustard", "Dijon mustard"),
      ing("3/4 cup fresh parsley and mint, minced", "parsley and mint"),
      ing("1/2 cup panko breadcrumbs", "panko breadcrumbs"),
      ing("2 cloves garlic, grated", "garlic"),
      ing("2 tbsp olive oil", "olive oil"),
    ],
    steps: [
      {
        text: "Sear lamb racks fat-side down in olive oil until browned, then brush with Dijon mustard.",
        ingredients: [
          { label: "2 frenched racks of lamb" },
          { label: "2 tbsp olive oil" },
          { label: "2 tbsp Dijon mustard" },
        ],
      },
      {
        text: "Press panko, herbs, and garlic into the mustard coating; roast at 400°F until internal temp hits 130°F.",
        ingredients: [
          { label: "1/2 cup panko breadcrumbs" },
          { label: "3/4 cup parsley and mint" },
          { label: "2 cloves garlic, grated" },
        ],
        timers: [
          {
            id: "roast-lamb",
            label: "Roast lamb racks",
            durationSeconds: 22 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "tofu-banh-mi-bowls",
    title: "Crispy Tofu Banh Mi Rice Bowls with Pickled Daikon",
    servings: 4,
    facts: {
      primaryProtein: "tofu/tempeh",
      totalMinutes: 35,
      effort: "medium",
      mealTypes: ["lunch", "dinner"],
    },
    ingredients: [
      ing("14 oz extra-firm tofu, pressed and cubed", "extra-firm tofu"),
      ing("2 cups cooked jasmine rice", "jasmine rice"),
      ing("1 cup matchstick carrots and daikon", "carrots and daikon"),
      ing("3 tbsp rice vinegar", "rice vinegar"),
      ing("1 tbsp sriracha", "sriracha"),
      ing("2 tbsp mayo", "mayo"),
      ing("1/2 cup fresh cilantro sprigs", "cilantro"),
    ],
    steps: [
      {
        text: "Quick-pickle matchstick carrots and daikon in rice vinegar with a pinch of salt and sugar.",
        ingredients: [
          { label: "1 cup matchstick carrots and daikon" },
          { label: "3 tbsp rice vinegar" },
        ],
      },
      {
        text: "Pan-fry or air-fry tofu cubes until crisp and golden on all sides.",
        ingredients: [{ label: "14 oz extra-firm tofu, cubed" }],
        timers: [
          {
            id: "crisp-tofu",
            label: "Crisp tofu cubes",
            durationSeconds: 10 * 60,
          },
        ],
      },
      {
        text: "Serve tofu over warm jasmine rice with quick pickles, cilantro, and sriracha mayo.",
        ingredients: [
          { label: "2 cups cooked jasmine rice" },
          { label: "1 tbsp sriracha" },
          { label: "2 tbsp mayo" },
          { label: "1/2 cup fresh cilantro sprigs" },
        ],
      },
    ],
  },
  {
    id: "pan-roasted-cod-fennel",
    title: "Pan-Roasted Cod with Fennel, Olives, and Blood Orange",
    servings: 2,
    facts: {
      primaryProtein: "fish",
      totalMinutes: 30,
      effort: "low",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("2 thick cod fillets (6 oz each)", "cod fillets"),
      ing("1 fennel bulb, thinly shaved", "fennel"),
      ing("1/3 cup Castelvetrano olives, pitted", "olives"),
      ing("1 blood orange, segmented", "blood orange"),
      ing("2 tbsp olive oil", "olive oil"),
    ],
    steps: [
      {
        text: "Sauté shaved fennel in olive oil until translucent and sweet.",
        ingredients: [
          { label: "1 fennel bulb, shaved" },
          { label: "2 tbsp olive oil" },
        ],
      },
      {
        text: "Nestle cod fillets over fennel with olives and roast at 400°F until fish flakes cleanly, then garnish with blood orange segments.",
        ingredients: [
          { label: "2 thick cod fillets" },
          { label: "1/3 cup Castelvetrano olives" },
          { label: "1 blood orange, segmented" },
        ],
        timers: [
          {
            id: "bake-cod",
            label: "Roast cod",
            durationSeconds: 12 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "miso-salmon-parcels",
    title: "Miso-Glazed Salmon Rice Paper Parcels",
    servings: 2,
    facts: {
      primaryProtein: "fish",
      totalMinutes: 25,
      effort: "medium",
      mealTypes: ["lunch", "dinner"],
    },
    ingredients: [
      ing("2 skinless salmon fillets", "salmon fillets"),
      ing("2 tbsp white miso paste", "white miso"),
      ing("1 tbsp mirin", "mirin"),
      ing("4 rice paper wrappers", "rice paper wrappers"),
      ing("1 cup shredded cucumber", "cucumber"),
    ],
    steps: [
      {
        text: "Brush salmon with white miso and mirin; broil 8 minutes until caramelized.",
        ingredients: [
          { label: "2 skinless salmon fillets" },
          { label: "2 tbsp white miso paste" },
          { label: "1 tbsp mirin" },
        ],
        timers: [
          {
            id: "broil-salmon",
            label: "Broil miso salmon",
            durationSeconds: 8 * 60,
          },
        ],
      },
      {
        text: "Soften rice paper wrappers in warm water and wrap flaked salmon with shredded cucumber.",
        ingredients: [
          { label: "4 rice paper wrappers" },
          { label: "1 cup shredded cucumber" },
        ],
      },
    ],
  },
  {
    id: "garlic-butter-shrimp-skillet",
    title: "Garlic Butter Shrimp Skillet with Charred Sourdough",
    servings: 2,
    facts: {
      primaryProtein: "shellfish",
      totalMinutes: 18,
      effort: "low",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("1 lb large peeled shrimp, deveined", "shrimp"),
      ing("3 tbsp unsalted butter", "unsalted butter"),
      ing("5 cloves garlic, thinly sliced", "garlic"),
      ing("1/4 cup dry white wine", "white wine"),
      ing("4 slices sourdough bread", "sourdough bread"),
    ],
    steps: [
      {
        text: "Toast sourdough slices in a dry skillet until charred at the edges; set aside.",
        ingredients: [{ label: "4 slices sourdough bread" }],
      },
      {
        text: "Melt butter over medium heat, sizzle garlic slices 45 seconds, add shrimp and wine, and toss until shrimp turn pink and curl.",
        ingredients: [
          { label: "3 tbsp unsalted butter" },
          { label: "5 cloves garlic, thinly sliced" },
          { label: "1 lb large shrimp" },
          { label: "1/4 cup dry white wine" },
        ],
        timers: [
          {
            id: "cook-shrimp",
            label: "Simmer garlic shrimp",
            durationSeconds: 4 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "ginger-scallion-ground-chicken-cups",
    title: "Ginger-Scallion Ground Chicken Lettuce Cups",
    servings: 4,
    facts: {
      primaryProtein: "chicken",
      totalMinutes: 22,
      effort: "low",
      mealTypes: ["lunch", "dinner"],
    },
    ingredients: [
      ing("1 lb ground chicken", "ground chicken"),
      ing("1 tbsp fresh ginger, grated", "fresh ginger"),
      ing("4 scallions, thinly sliced", "scallions"),
      ing("2 tbsp hoisin sauce", "hoisin sauce"),
      ing("1 head butter lettuce, leaves separated", "butter lettuce"),
    ],
    steps: [
      {
        text: "Brown ground chicken in a hot wok or skillet until cooked through and crumbly.",
        ingredients: [{ label: "1 lb ground chicken" }],
        timers: [
          {
            id: "brown-ground-chicken",
            label: "Cook ground chicken",
            durationSeconds: 6 * 60,
          },
        ],
      },
      {
        text: "Stir in ginger, scallion whites, and hoisin sauce; spoon into crisp butter lettuce cups and top with scallion greens.",
        ingredients: [
          { label: "1 tbsp grated ginger" },
          { label: "4 scallions, sliced" },
          { label: "2 tbsp hoisin sauce" },
          { label: "1 head butter lettuce" },
        ],
      },
    ],
  },
  {
    id: "roasted-turkey-breast-gravy",
    title: "Roasted Turkey Breast Pan Gravy with Sage and Shallot",
    servings: 6,
    facts: {
      primaryProtein: "turkey",
      totalMinutes: 75,
      effort: "medium",
      mealTypes: ["dinner"],
    },
    ingredients: [
      ing("3 lb bone-in turkey breast", "turkey breast"),
      ing("2 cups chicken stock", "chicken stock"),
      ing("2 tbsp unsalted butter", "unsalted butter"),
      ing("2 tbsp all-purpose flour", "all-purpose flour"),
      ing("1 shallot, minced", "shallot"),
      ing("4 fresh sage leaves", "sage leaves"),
    ],
    steps: [
      {
        text: "Rub turkey breast with butter and roast at 375°F until an instant-read thermometer reaches 160°F at the thickest part.",
        ingredients: [
          { label: "3 lb bone-in turkey breast" },
          { label: "1 tbsp unsalted butter" },
        ],
        timers: [
          {
            id: "roast-turkey",
            label: "Roast turkey breast",
            durationSeconds: 55 * 60,
          },
        ],
      },
      {
        text: "Whisk flour into pan drippings with 1 tbsp butter, minced shallot, and sage; stream in chicken stock and simmer until velvety.",
        ingredients: [
          { label: "1 tbsp unsalted butter" },
          { label: "2 tbsp all-purpose flour" },
          { label: "1 shallot, minced" },
          { label: "4 sage leaves" },
          { label: "2 cups chicken stock" },
        ],
      },
    ],
  },
  {
    id: "cardamom-orange-overnight-oats",
    title: "Cardamom-Orange Overnight Oats with Toasted Almonds",
    servings: 2,
    facts: {
      primaryProtein: "dairy",
      totalMinutes: 10,
      effort: "low",
      mealTypes: ["breakfast"],
    },
    ingredients: [
      ing("1 cup rolled oats", "rolled oats"),
      ing("1 cup whole milk", "whole milk"),
      ing("1/2 cup Greek yogurt", "Greek yogurt"),
      ing("1/4 tsp ground cardamom", "cardamom"),
      ing("1 orange, zested", "orange zest"),
      ing("2 tbsp toasted sliced almonds", "almonds"),
    ],
    steps: [
      {
        text: "Stir oats, milk, Greek yogurt, cardamom, and orange zest in jars; chill overnight.",
        ingredients: [
          { label: "1 cup rolled oats" },
          { label: "1 cup whole milk" },
          { label: "1/2 cup Greek yogurt" },
          { label: "1/4 tsp ground cardamom" },
          { label: "1 orange, zested" },
        ],
      },
      {
        text: "Top with toasted sliced almonds right before eating.",
        ingredients: [{ label: "2 tbsp toasted sliced almonds" }],
      },
    ],
  },
  {
    id: "laminated-rosemary-brioche-galette",
    title: "Laminated Rosemary Brioche Breakfast Galette",
    servings: 4,
    facts: {
      primaryProtein: "eggs",
      totalMinutes: 140,
      effort: "high",
      mealTypes: ["breakfast"],
    },
    ingredients: [
      ing("2.5 cups bread flour", "bread flour"),
      ing("12 tbsp cold European butter", "butter"),
      ing("3 large eggs", "eggs"),
      ing("1 tbsp fresh rosemary, minced", "rosemary"),
      ing("4 oz aged Gruyère, grated", "Gruyère"),
    ],
    steps: [
      {
        text: "Mix enriched dough with 2 eggs and chill 45 minutes before folding in cold butter block.",
        ingredients: [
          { label: "2.5 cups bread flour" },
          { label: "12 tbsp cold butter" },
          { label: "2 large eggs" },
        ],
        timers: [
          {
            id: "chill-dough",
            label: "Chill brioche dough",
            durationSeconds: 45 * 60,
          },
        ],
      },
      {
        text: "Complete three letter folds with rosemary, top with Gruyère and remaining egg, and bake at 400°F until puffed and mahogany.",
        ingredients: [
          { label: "1 tbsp fresh rosemary" },
          { label: "4 oz grated Gruyère" },
          { label: "1 large egg" },
        ],
        timers: [
          {
            id: "bake-galette",
            label: "Bake galette",
            durationSeconds: 25 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "crispy-smoked-paprika-chickpeas",
    title: "Crispy Roasted Chickpeas with Smoked Paprika and Lime",
    servings: 4,
    facts: {
      primaryProtein: "beans/lentils",
      totalMinutes: 30,
      effort: "low",
      mealTypes: ["snack"],
    },
    ingredients: [
      ing("2 cans chickpeas, patted dry", "chickpeas"),
      ing("1.5 tbsp olive oil", "olive oil"),
      ing("1 tsp smoked paprika", "smoked paprika"),
      ing("1/2 tsp kosher salt", "kosher salt"),
      ing("1 lime, zested", "lime zest"),
    ],
    steps: [
      {
        text: "Toss thoroughly dried chickpeas with olive oil, smoked paprika, and kosher salt; roast at 425°F until crunchy.",
        ingredients: [
          { label: "2 cans chickpeas, dried" },
          { label: "1.5 tbsp olive oil" },
          { label: "1 tsp smoked paprika" },
          { label: "1/2 tsp kosher salt" },
        ],
        timers: [
          {
            id: "roast-chickpeas",
            label: "Roast chickpeas",
            durationSeconds: 24 * 60,
          },
        ],
      },
      {
        text: "Toss hot chickpeas with fresh lime zest.",
        ingredients: [{ label: "1 lime, zested" }],
      },
    ],
  },
  {
    id: "burnt-basque-cheesecake",
    title: "Burnt Basque Cheesecake with Espresso Sugar Crust",
    servings: 8,
    facts: {
      primaryProtein: "dairy",
      totalMinutes: 60,
      effort: "medium",
      mealTypes: ["dessert"],
    },
    ingredients: [
      ing("2 lbs full-fat cream cheese, room temperature", "cream cheese"),
      ing("1.25 cups granulated sugar", "granulated sugar"),
      ing("5 large eggs", "eggs"),
      ing("1.5 cups heavy cream", "heavy cream"),
      ing("1 tsp instant espresso powder", "espresso powder"),
      ing("2 tbsp all-purpose flour", "all-purpose flour"),
    ],
    steps: [
      {
        text: "Beat cream cheese and sugar until smooth, then add eggs one by one followed by heavy cream, espresso powder, and flour.",
        ingredients: [
          { label: "2 lbs cream cheese" },
          { label: "1.25 cups sugar" },
          { label: "5 large eggs" },
          { label: "1.5 cups heavy cream" },
          { label: "1 tsp espresso powder" },
          { label: "2 tbsp flour" },
        ],
      },
      {
        text: "Pour into a parchment-lined 9-inch springform pan and bake at 425°F until deeply caramelized on top and jiggly in the center.",
        ingredients: [],
        timers: [
          {
            id: "bake-cheesecake",
            label: "Bake Basque cheesecake",
            durationSeconds: 42 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "poached-pears-hibiscus",
    title: "Poached Pears in Spiced Hibiscus Syrup",
    servings: 4,
    facts: {
      primaryProtein: null,
      totalMinutes: 40,
      effort: "low",
      mealTypes: ["dessert"],
    },
    ingredients: [
      ing("4 firm Bosc pears, peeled with stems intact", "Bosc pears"),
      ing("1/2 cup dried hibiscus flowers", "hibiscus flowers"),
      ing("1/2 cup granulated sugar", "sugar"),
      ing("1 star anise pod", "star anise"),
      ing("1 strip orange peel", "orange peel"),
    ],
    steps: [
      {
        text: "Simmer 3 cups water, hibiscus, sugar, star anise, and orange peel for 5 minutes to infuse deep ruby color.",
        ingredients: [
          { label: "1/2 cup dried hibiscus flowers" },
          { label: "1/2 cup sugar" },
          { label: "1 star anise pod" },
          { label: "1 strip orange peel" },
        ],
      },
      {
        text: "Submerge pears and poach gently, turning occasionally, until a paring knife slides in effortlessly.",
        ingredients: [{ label: "4 peeled Bosc pears" }],
        timers: [
          {
            id: "poach-pears",
            label: "Poach pears",
            durationSeconds: 25 * 60,
          },
        ],
      },
    ],
  },
  {
    id: "skillet-white-beans-sweet-paprika",
    title: "Skillet White Beans and Greens with Sweet Paprika Toast and Poached Egg",
    servings: 2,
    facts: {
      primaryProtein: "eggs",
      totalMinutes: 25,
      effort: "low",
      mealTypes: ["breakfast", "lunch", "dinner"],
    },
    ingredients: [
      ing("1 can cannellini white beans, drained", "white beans"),
      ing("3 cups Tuscan kale, chopped", "Tuscan kale"),
      ing("1 tsp sweet paprika", "sweet paprika"),
      ing("2 large eggs", "eggs"),
      ing("2 slices country bread", "country bread"),
      ing("2 tbsp olive oil", "olive oil"),
    ],
    steps: [
      {
        text: "Warm olive oil and sweet paprika in a skillet, add white beans and kale with a splash of water, and simmer until greens wilt.",
        ingredients: [
          { label: "2 tbsp olive oil" },
          { label: "1 tsp sweet paprika" },
          { label: "1 can white beans" },
          { label: "3 cups Tuscan kale" },
        ],
        timers: [
          {
            id: "simmer-beans",
            label: "Simmer beans & greens",
            durationSeconds: 7 * 60,
          },
        ],
      },
      {
        text: "Toast country bread and poach eggs in simmering water until whites are set and yolks remain runny.",
        ingredients: [
          { label: "2 slices country bread" },
          { label: "2 large eggs" },
        ],
        timers: [
          {
            id: "poach-eggs",
            label: "Poach eggs",
            durationSeconds: 3 * 60,
          },
        ],
      },
    ],
  },
];

export const SAMPLE_RECIPES: PrototypeRecipe[] = RAW_SAMPLE_RECIPES.map(
  (recipe) => {
    const meta = CARD_META[recipe.id];
    return {
      ...recipe,
      shortTitle: meta?.shortTitle ?? recipe.title.slice(0, 26),
      imageUrl: meta?.imageUrl,
    };
  },
);
