import { emptyRecipeFacts } from "@cookbook/shared";

import type {
  PrototypeIngredient,
  PrototypeRecipe,
  PrototypeStep,
  RecipeFacts,
} from "./types";

function item(
  id: string,
  name: string,
  amount: number | null = null,
  unit = "",
): PrototypeIngredient {
  const qty =
    amount === null ? "" : unit === "" ? String(amount) : `${amount} ${unit}`;
  const line = qty === "" ? name : `${qty} ${name}`;
  return { id, name, amount, unit, line };
}

function step(
  text: string,
  ingredients: PrototypeStep["ingredients"] = [],
  extra: Pick<PrototypeStep, "durationSeconds" | "timerLabel"> = {},
): PrototypeStep {
  return { text, ingredients, ...extra };
}

function facts(partial: Partial<RecipeFacts>): RecipeFacts {
  return { ...emptyRecipeFacts(), ...partial };
}

const lemonChicken: PrototypeRecipe = {
  id: "lemon-chicken-bowls",
  title: "Example: Lemon chicken bowls",
  servings: 4,
  facts: facts({
    primaryProtein: "chicken",
    totalMinutes: 35,
    effort: "medium",
    mealTypes: ["dinner"],
  }),
  ingredients: [
    item("chicken", "chicken breast", 600, "g"),
    item("lemon", "lemon", 2, ""),
    item("garlic", "garlic cloves", 3, ""),
    item("rice", "cooked rice", 3, "cups"),
    item("broccoli", "broccoli florets", 300, "g"),
    item("oil", "olive oil", 2, "tbsp"),
    item("salt", "kosher salt", 1, "tsp"),
  ],
  steps: [
    step("Salt the chicken and heat the oven to 425°F.", [
      { ingredientId: "chicken", amount: "600 g" },
      { ingredientId: "salt", amount: "1 tsp" },
    ]),
    step("Toss broccoli with oil and lemon zest.", [
      { ingredientId: "broccoli", amount: "300 g" },
      { ingredientId: "oil", amount: "1 tbsp" },
      { ingredientId: "lemon", amount: "zest of 1" },
    ]),
    step("Roast the chicken until the juices run clear.", [
      { ingredientId: "chicken", amount: "600 g" },
    ], { durationSeconds: 18 * 60, timerLabel: "Roast chicken" }),
    step("Reduce lemon pan sauce while the chicken roasts.", [
      { ingredientId: "lemon", amount: "juice of 2" },
      { ingredientId: "garlic", amount: "3 cloves" },
      { ingredientId: "oil", amount: "1 tbsp" },
    ], { durationSeconds: 8 * 60, timerLabel: "Reduce sauce" }),
    step("Slice the chicken and build bowls over rice.", [
      { ingredientId: "rice", amount: "3 cups" },
    ]),
  ],
};

const sundayStew: PrototypeRecipe = {
  id: "three-hour-sunday-beef-stew",
  title: "Example: Three-hour Sunday beef stew",
  servings: 6,
  facts: facts({
    primaryProtein: "beef",
    totalMinutes: 180,
    effort: "low",
    mealTypes: ["dinner"],
  }),
  ingredients: [
    item("beef", "beef chuck", 1200, "g"),
    item("onion", "yellow onion", 2, ""),
    item("carrot", "carrots", 4, ""),
    item("stock", "beef stock", 4, "cups"),
    item("flour", "flour", 1, "cup"),
    item("suet", "cold butter", 80, "g"),
    item("thyme", "thyme sprigs", 4, ""),
  ],
  steps: [
    step("Brown the beef in batches and set it aside.", [
      { ingredientId: "beef", amount: "1200 g" },
    ]),
    step("Sweat onion and carrot, then return the beef with stock and thyme.", [
      { ingredientId: "onion", amount: "2" },
      { ingredientId: "carrot", amount: "4" },
      { ingredientId: "stock", amount: "4 cups" },
      { ingredientId: "thyme", amount: "4 sprigs" },
    ]),
    step("Simmer the stew, covered, until the beef yields.", [
      { ingredientId: "beef", amount: "1200 g" },
    ], { durationSeconds: 150 * 60, timerLabel: "Simmer stew" }),
    step("Rub butter into flour for dumplings.", [
      { ingredientId: "flour", amount: "1 cup" },
      { ingredientId: "suet", amount: "80 g" },
    ]),
    step("Set dumplings on the stew and steam them while it finishes.", [
      { ingredientId: "flour", amount: "dumpling dough" },
    ], { durationSeconds: 25 * 60, timerLabel: "Steam dumplings" }),
    step("Taste for salt and serve in wide bowls."),
  ],
};

const scallops: PrototypeRecipe = {
  id: "seared-scallop-supper",
  title: "Example: Five-minute seared scallops",
  servings: 2,
  facts: facts({
    primaryProtein: "shellfish",
    totalMinutes: 12,
    effort: "high",
    mealTypes: ["dinner"],
  }),
  ingredients: [
    item("scallops", "dry sea scallops", 8, ""),
    item("butter", "butter", 2, "tbsp"),
    item("oil", "neutral oil", 1, "tbsp"),
    item("lemon", "lemon", 1, ""),
    item("salt", "kosher salt", 0.5, "tsp"),
  ],
  steps: [
    step("Pat the scallops dry and salt them.", [
      { ingredientId: "scallops", amount: "8" },
      { ingredientId: "salt", amount: "1/2 tsp" },
    ]),
    step("Sear in a ripping-hot pan without moving them.", [
      { ingredientId: "scallops", amount: "8" },
      { ingredientId: "oil", amount: "1 tbsp" },
    ], { durationSeconds: 2 * 60, timerLabel: "First sear" }),
    step("Baste with butter and lemon, then plate immediately.", [
      { ingredientId: "butter", amount: "2 tbsp" },
      { ingredientId: "lemon", amount: "1" },
    ]),
  ],
};

const friedRice: PrototypeRecipe = {
  id: "everything-fried-rice",
  title: "Example: Everything-but-the-sink fried rice",
  servings: 4,
  facts: facts({
    primaryProtein: "pork",
    totalMinutes: 30,
    effort: "medium",
    mealTypes: ["dinner"],
  }),
  ingredients: [
    item("rice", "day-old rice", 4, "cups"),
    item("pork", "char siu pork", 200, "g"),
    item("eggs", "eggs", 3, ""),
    item("peas", "frozen peas", 1, "cup"),
    item("carrot", "carrot", 1, ""),
    item("onion", "onion", 1, ""),
    item("garlic", "garlic", 3, "cloves"),
    item("ginger", "ginger", 1, "tbsp"),
    item("scallion", "scallions", 4, ""),
    item("soy", "soy sauce", 3, "tbsp"),
    item("sesame", "sesame oil", 1, "tsp"),
    item("pepper", "white pepper", 0.25, "tsp"),
    item("wine", "Shaoxing wine", 1, "tbsp"),
    item("corn", "frozen corn", 0.5, "cup"),
    item("cabbage", "napa cabbage", 1, "cup"),
    item("mushroom", "shiitake mushrooms", 4, ""),
    item("chili", "chili crisp", 1, "tbsp"),
  ],
  steps: [
    step("Scramble the eggs and set them aside.", [
      { ingredientId: "eggs", amount: "3" },
    ], { durationSeconds: 2 * 60, timerLabel: "Scramble eggs" }),
    step("Stir-fry pork, mushrooms, and aromatics.", [
      { ingredientId: "pork", amount: "200 g" },
      { ingredientId: "mushroom", amount: "4" },
      { ingredientId: "garlic", amount: "3 cloves" },
      { ingredientId: "ginger", amount: "1 tbsp" },
    ]),
    step("Add rice, vegetables, soy, and wine, then fold the eggs back in.", [
      { ingredientId: "rice", amount: "4 cups" },
      { ingredientId: "peas", amount: "1 cup" },
      { ingredientId: "carrot", amount: "1" },
      { ingredientId: "onion", amount: "1" },
      { ingredientId: "corn", amount: "1/2 cup" },
      { ingredientId: "cabbage", amount: "1 cup" },
      { ingredientId: "soy", amount: "3 tbsp" },
      { ingredientId: "wine", amount: "1 tbsp" },
      { ingredientId: "eggs", amount: "scrambled" },
    ]),
    step("Finish with sesame oil, white pepper, scallion, and chili crisp.", [
      { ingredientId: "sesame", amount: "1 tsp" },
      { ingredientId: "pepper", amount: "1/4 tsp" },
      { ingredientId: "scallion", amount: "4" },
      { ingredientId: "chili", amount: "1 tbsp" },
    ]),
  ],
};

const seitanStirFry: PrototypeRecipe = {
  id: "seitan-pepper-stir-fry",
  title: "Example: Seitan and pepper stir-fry",
  servings: 3,
  facts: facts({
    primaryProtein: "seitan",
    totalMinutes: 25,
    effort: "medium",
    mealTypes: ["dinner"],
  }),
  ingredients: [
    item("seitan", "seitan strips", 400, "g"),
    item("pepper", "bell peppers", 2, ""),
    item("soy", "soy sauce", 2, "tbsp"),
    item("oil", "peanut oil", 2, "tbsp"),
  ],
  steps: [
    step("Sear seitan until browned.", [
      { ingredientId: "seitan", amount: "400 g" },
      { ingredientId: "oil", amount: "1 tbsp" },
    ], { durationSeconds: 4 * 60, timerLabel: "Sear seitan" }),
    step("Stir-fry peppers and sauce.", [
      { ingredientId: "pepper", amount: "2" },
      { ingredientId: "soy", amount: "2 tbsp" },
    ]),
  ],
};

export const SAMPLE_RECIPES: PrototypeRecipe[] = [
  lemonChicken,
  sundayStew,
  scallops,
  friedRice,
  seitanStirFry,
  {
    id: "ground-chicken-lettuce-cups",
    title: "Example: Ground chicken lettuce cups",
    servings: 4,
    facts: facts({
      primaryProtein: "chicken",
      totalMinutes: 25,
      effort: "medium",
      mealTypes: ["lunch"],
    }),
    ingredients: [
      item("chicken", "ground chicken", 500, "g"),
      item("lettuce", "butter lettuce leaves", 12, ""),
      item("soy", "soy sauce", 2, "tbsp"),
      item("ginger", "ginger", 1, "tbsp"),
    ],
    steps: [
      step("Brown the ground chicken with ginger.", [
        { ingredientId: "chicken", amount: "500 g" },
        { ingredientId: "ginger", amount: "1 tbsp" },
      ]),
      step("Season with soy and spoon into lettuce cups.", [
        { ingredientId: "soy", amount: "2 tbsp" },
        { ingredientId: "lettuce", amount: "12 leaves" },
      ]),
    ],
  },
  {
    id: "chicken-thigh-sheet-pan",
    title: "Example: Chicken thigh sheet pan",
    servings: 4,
    facts: facts({
      primaryProtein: "chicken",
      totalMinutes: 40,
      effort: "low",
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("chicken", "chicken thighs", 8, ""),
      item("potato", "baby potatoes", 600, "g"),
      item("oil", "olive oil", 2, "tbsp"),
    ],
    steps: [
      step("Roast chicken thighs over potatoes.", [
        { ingredientId: "chicken", amount: "8" },
        { ingredientId: "potato", amount: "600 g" },
        { ingredientId: "oil", amount: "2 tbsp" },
      ]),
    ],
  },
  {
    id: "miso-glazed-cod",
    title: "Example: Miso-glazed cod",
    servings: 2,
    facts: facts({
      primaryProtein: "fish",
      totalMinutes: 30,
      effort: "medium",
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("cod", "cod fillets", 2, ""),
      item("miso", "white miso", 2, "tbsp"),
      item("mirin", "mirin", 1, "tbsp"),
    ],
    steps: [
      step("Broil miso-glazed cod until caramelized.", [
        { ingredientId: "cod", amount: "2 fillets" },
        { ingredientId: "miso", amount: "2 tbsp" },
        { ingredientId: "mirin", amount: "1 tbsp" },
      ]),
    ],
  },
  {
    id: "garlic-butter-shrimp",
    title: "Example: Garlic butter shrimp",
    servings: 2,
    facts: facts({
      primaryProtein: "shellfish",
      totalMinutes: 20,
      effort: "medium",
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("shrimp", "shrimp", 400, "g"),
      item("garlic", "garlic", 4, "cloves"),
      item("butter", "butter", 3, "tbsp"),
    ],
    steps: [
      step("Sauté shrimp in garlic butter.", [
        { ingredientId: "shrimp", amount: "400 g" },
        { ingredientId: "garlic", amount: "4 cloves" },
        { ingredientId: "butter", amount: "3 tbsp" },
      ]),
    ],
  },
  {
    id: "tomato-cucumber-salad",
    title: "Example: Tomato cucumber salad",
    servings: 4,
    facts: facts({
      primaryProtein: "no protein",
      totalMinutes: 15,
      effort: "low",
      mealTypes: ["lunch"],
    }),
    ingredients: [
      item("tomato", "ripe tomatoes", 4, ""),
      item("cucumber", "cucumber", 1, ""),
      item("oil", "olive oil", 2, "tbsp"),
    ],
    steps: [
      step("Slice tomatoes and cucumber, then dress with oil.", [
        { ingredientId: "tomato", amount: "4" },
        { ingredientId: "cucumber", amount: "1" },
        { ingredientId: "oil", amount: "2 tbsp" },
      ]),
    ],
  },
  {
    id: "draft-with-no-facts",
    title: "Example: Untitled draft from last Tuesday",
    servings: 2,
    facts: emptyRecipeFacts(),
    ingredients: [item("notes", "half a jar of something", null, "")],
    steps: [],
  },
  {
    id: "lunch-dinner-farro-bowl",
    title: "Example: Farro bowl that works for lunch or dinner",
    servings: 2,
    facts: facts({
      primaryProtein: "beans/lentils",
      totalMinutes: 40,
      effort: "medium",
      mealTypes: ["lunch", "dinner"],
    }),
    ingredients: [
      item("farro", "farro", 1, "cup"),
      item("lentils", "French lentils", 1, "cup"),
      item("greens", "arugula", 2, "cups"),
    ],
    steps: [
      step("Simmer farro and lentils, then toss with arugula.", [
        { ingredientId: "farro", amount: "1 cup" },
        { ingredientId: "lentils", amount: "1 cup" },
        { ingredientId: "greens", amount: "2 cups" },
      ]),
    ],
  },
  {
    id: "very-long-market-sheet-pan",
    title:
      "Example: The Very Long Named Sheet-Pan Supper With Lemon, Olives, Potatoes, Wilted Greens, and a Side of Stories From the Tuesday Market",
    servings: 4,
    facts: facts({
      primaryProtein: "chicken",
      totalMinutes: 55,
      effort: "low",
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("chicken", "chicken drumsticks", 8, ""),
      item("olive", "Castelvetrano olives", 1, "cup"),
      item("lemon", "lemons", 2, ""),
    ],
    steps: [
      step("Pile everything on a sheet pan and roast.", [
        { ingredientId: "chicken", amount: "8" },
        { ingredientId: "olive", amount: "1 cup" },
        { ingredientId: "lemon", amount: "2" },
      ]),
    ],
  },
  {
    id: "pantry-red-lentil-soup",
    title: "Example: Pantry red lentil soup",
    servings: 6,
    facts: facts({
      primaryProtein: "beans/lentils",
      totalMinutes: 45,
      effort: "low",
      mealTypes: ["lunch"],
    }),
    ingredients: [
      item("lentils", "red lentils", 2, "cups"),
      item("onion", "onion", 1, ""),
      item("cumin", "cumin", 1, "tsp"),
    ],
    steps: [
      step("Simmer lentils with onion and cumin until soft.", [
        { ingredientId: "lentils", amount: "2 cups" },
        { ingredientId: "onion", amount: "1" },
        { ingredientId: "cumin", amount: "1 tsp" },
      ]),
    ],
  },
  {
    id: "soft-boiled-eggs-toast",
    title: "Example: Soft-boiled eggs on toast",
    servings: 1,
    facts: facts({
      primaryProtein: "eggs",
      totalMinutes: 12,
      effort: "low",
      mealTypes: ["breakfast"],
    }),
    ingredients: [
      item("eggs", "eggs", 2, ""),
      item("bread", "sourdough", 2, "slices"),
    ],
    steps: [
      step("Boil the eggs, toast the bread, and assemble.", [
        { ingredientId: "eggs", amount: "2" },
        { ingredientId: "bread", amount: "2 slices" },
      ], { durationSeconds: 7 * 60, timerLabel: "Boil eggs" }),
    ],
  },
  {
    id: "pork-cabbage-dumplings",
    title: "Example: Pork and cabbage dumplings",
    servings: 4,
    facts: facts({
      primaryProtein: "pork",
      totalMinutes: 50,
      effort: "high",
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("pork", "ground pork", 400, "g"),
      item("cabbage", "napa cabbage", 2, "cups"),
      item("wrappers", "dumpling wrappers", 30, ""),
    ],
    steps: [
      step("Fill wrappers and pan-fry, then steam.", [
        { ingredientId: "pork", amount: "400 g" },
        { ingredientId: "cabbage", amount: "2 cups" },
        { ingredientId: "wrappers", amount: "30" },
      ]),
    ],
  },
  {
    id: "turkey-weeknight-chili",
    title: "Example: Turkey weeknight chili",
    servings: 6,
    facts: facts({
      primaryProtein: "turkey",
      totalMinutes: 60,
      effort: "medium",
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("turkey", "ground turkey", 700, "g"),
      item("beans", "kidney beans", 2, "cans"),
      item("tomato", "crushed tomatoes", 1, "can"),
    ],
    steps: [
      step("Brown turkey, add beans and tomatoes, and simmer.", [
        { ingredientId: "turkey", amount: "700 g" },
        { ingredientId: "beans", amount: "2 cans" },
        { ingredientId: "tomato", amount: "1 can" },
      ]),
    ],
  },
  {
    id: "tofu-ginger-mapo",
    title: "Example: Tofu ginger mapo",
    servings: 3,
    facts: facts({
      primaryProtein: "tofu/tempeh",
      totalMinutes: 35,
      effort: "medium",
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("tofu", "soft tofu", 400, "g"),
      item("douban", "doubanjiang", 2, "tbsp"),
      item("ginger", "ginger", 1, "tbsp"),
    ],
    steps: [
      step("Simmer tofu in ginger and doubanjiang sauce.", [
        { ingredientId: "tofu", amount: "400 g" },
        { ingredientId: "douban", amount: "2 tbsp" },
        { ingredientId: "ginger", amount: "1 tbsp" },
      ]),
    ],
  },
  {
    id: "yogurt-berry-parfait",
    title: "Example: Yogurt berry parfait",
    servings: 2,
    facts: facts({
      primaryProtein: "dairy",
      totalMinutes: 10,
      effort: "low",
      mealTypes: ["breakfast", "snack"],
    }),
    ingredients: [
      item("yogurt", "plain yogurt", 2, "cups"),
      item("berries", "mixed berries", 1, "cup"),
      item("granola", "granola", 0.5, "cup"),
    ],
    steps: [
      step("Layer yogurt, berries, and granola.", [
        { ingredientId: "yogurt", amount: "2 cups" },
        { ingredientId: "berries", amount: "1 cup" },
        { ingredientId: "granola", amount: "1/2 cup" },
      ]),
    ],
  },
  {
    id: "roast-chicken-missing-time",
    title: "Example: Roast chicken with no time set",
    servings: 4,
    facts: facts({
      primaryProtein: "chicken",
      totalMinutes: null,
      effort: "medium",
      mealTypes: ["dinner"],
    }),
    ingredients: [item("chicken", "whole chicken", 1, "")],
    steps: [step("Roast the chicken until done.", [{ ingredientId: "chicken", amount: "1" }])],
  },
  {
    id: "weeknight-pasta-missing-effort",
    title: "Example: Weeknight pasta with no effort set",
    servings: 2,
    facts: facts({
      primaryProtein: "dairy",
      totalMinutes: 25,
      effort: null,
      mealTypes: ["dinner"],
    }),
    ingredients: [
      item("pasta", "spaghetti", 250, "g"),
      item("cheese", "parmesan", 40, "g"),
    ],
    steps: [
      step("Boil pasta and toss with cheese.", [
        { ingredientId: "pasta", amount: "250 g" },
        { ingredientId: "cheese", amount: "40 g" },
      ]),
    ],
  },
  {
    id: "hummus-snack-plate",
    title: "Example: Hummus snack plate",
    servings: 2,
    facts: facts({
      primaryProtein: "beans/lentils",
      totalMinutes: 10,
      effort: "low",
      mealTypes: ["snack"],
    }),
    ingredients: [
      item("hummus", "hummus", 1, "cup"),
      item("carrot", "carrot sticks", 2, "cups"),
    ],
    steps: [
      step("Spoon hummus and add carrots.", [
        { ingredientId: "hummus", amount: "1 cup" },
        { ingredientId: "carrot", amount: "2 cups" },
      ]),
    ],
  },
  {
    id: "olive-oil-citrus-cake",
    title: "Example: Olive oil citrus cake",
    servings: 8,
    facts: facts({
      primaryProtein: null,
      totalMinutes: 70,
      effort: "medium",
      mealTypes: ["dessert"],
    }),
    ingredients: [
      item("flour", "flour", 2, "cups"),
      item("oil", "olive oil", 0.75, "cup"),
      item("orange", "orange zest", 2, "tbsp"),
    ],
    steps: [
      step("Bake the citrus cake until a tester comes out clean.", [
        { ingredientId: "flour", amount: "2 cups" },
        { ingredientId: "oil", amount: "3/4 cup" },
        { ingredientId: "orange", amount: "2 tbsp" },
      ], { durationSeconds: 50 * 60, timerLabel: "Bake cake" }),
    ],
  },
  {
    id: "chocolate-espresso-souffle",
    title: "Example: Chocolate espresso soufflé",
    servings: 4,
    facts: facts({
      primaryProtein: "eggs",
      totalMinutes: 45,
      effort: "high",
      mealTypes: ["dessert"],
    }),
    ingredients: [
      item("eggs", "egg whites", 4, ""),
      item("chocolate", "dark chocolate", 120, "g"),
      item("espresso", "espresso", 2, "tbsp"),
    ],
    steps: [
      step("Fold chocolate into whipped whites and bake at once.", [
        { ingredientId: "eggs", amount: "4 whites" },
        { ingredientId: "chocolate", amount: "120 g" },
        { ingredientId: "espresso", amount: "2 tbsp" },
      ]),
    ],
  },
  {
    id: "weekday-overnight-oats",
    title: "Example: Weekday overnight oats",
    servings: 1,
    facts: facts({
      primaryProtein: "dairy",
      totalMinutes: 480,
      effort: "low",
      mealTypes: ["breakfast"],
    }),
    ingredients: [
      item("oats", "rolled oats", 0.5, "cup"),
      item("milk", "milk", 0.5, "cup"),
      item("chia", "chia seeds", 1, "tbsp"),
    ],
    steps: [
      step("Stir oats, milk, and chia, then rest in the fridge.", [
        { ingredientId: "oats", amount: "1/2 cup" },
        { ingredientId: "milk", amount: "1/2 cup" },
        { ingredientId: "chia", amount: "1 tbsp" },
      ], { durationSeconds: 8 * 60 * 60, timerLabel: "Overnight rest" }),
    ],
  },
  {
    id: "duck-confit-hash",
    title: "Example: Duck confit hash",
    servings: 2,
    facts: facts({
      primaryProtein: "duck",
      totalMinutes: 35,
      effort: "medium",
      mealTypes: ["breakfast", "dinner"],
    }),
    ingredients: [
      item("duck", "duck confit", 2, "legs"),
      item("potato", "waxy potatoes", 400, "g"),
      item("egg", "eggs", 2, ""),
    ],
    steps: [
      step("Crisp duck and potatoes, then top with eggs.", [
        { ingredientId: "duck", amount: "2 legs" },
        { ingredientId: "potato", amount: "400 g" },
        { ingredientId: "egg", amount: "2" },
      ]),
    ],
  },
];
