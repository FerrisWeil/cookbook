export type PantryAsset = {
  key: string;
  label: string;
  imageUrl: string;
};

export const PANTRY_INGREDIENT_ASSETS: readonly PantryAsset[] = [
  {
    key: "beef-chuck",
    label: "Beef chuck",
    imageUrl: "/images/ingredients/beef-chuck.svg",
  },
  {
    key: "neutral-oil",
    label: "Neutral cooking oil",
    imageUrl: "/images/ingredients/neutral-oil.svg",
  },
  {
    key: "yellow-onion",
    label: "Yellow onion",
    imageUrl: "/images/ingredients/yellow-onion.svg",
  },
  {
    key: "carrot",
    label: "Whole carrots",
    imageUrl: "/images/ingredients/carrot.svg",
  },
  {
    key: "celery",
    label: "Celery stalks",
    imageUrl: "/images/ingredients/celery.svg",
  },
  {
    key: "garlic",
    label: "Garlic bulb",
    imageUrl: "/images/ingredients/garlic.svg",
  },
  {
    key: "tomato-paste",
    label: "Tomato paste",
    imageUrl: "/images/ingredients/tomato-paste.svg",
  },
  {
    key: "beef-broth",
    label: "Beef broth",
    imageUrl: "/images/ingredients/beef-broth.svg",
  },
  {
    key: "pearl-barley",
    label: "Pearl barley",
    imageUrl: "/images/ingredients/pearl-barley.svg",
  },
  {
    key: "bay-leaf",
    label: "Bay leaves",
    imageUrl: "/images/ingredients/bay-leaf.svg",
  },
  {
    key: "worcestershire",
    label: "Worcestershire sauce",
    imageUrl: "/images/ingredients/worcestershire.svg",
  },
  {
    key: "kosher-salt",
    label: "Kosher salt",
    imageUrl: "/images/ingredients/kosher-salt.svg",
  },
];

const PANTRY_KEYWORDS: ReadonlyArray<readonly [RegExp, PantryAsset]> = [
  [/beef chuck|beef stew/, PANTRY_INGREDIENT_ASSETS[0]!],
  [/neutral oil|olive oil|oil/, PANTRY_INGREDIENT_ASSETS[1]!],
  [/onion/, PANTRY_INGREDIENT_ASSETS[2]!],
  [/carrot/, PANTRY_INGREDIENT_ASSETS[3]!],
  [/celery/, PANTRY_INGREDIENT_ASSETS[4]!],
  [/garlic/, PANTRY_INGREDIENT_ASSETS[5]!],
  [/tomato paste/, PANTRY_INGREDIENT_ASSETS[6]!],
  [/beef broth|broth|stock/, PANTRY_INGREDIENT_ASSETS[7]!],
  [/barley/, PANTRY_INGREDIENT_ASSETS[8]!],
  [/bay lea/, PANTRY_INGREDIENT_ASSETS[9]!],
  [/worcestershire/, PANTRY_INGREDIENT_ASSETS[10]!],
  [/salt/, PANTRY_INGREDIENT_ASSETS[11]!],
];

export function resolvePantryIngredientAsset(
  line: string,
): PantryAsset | null {
  const lower = line.toLowerCase();
  for (const [pattern, asset] of PANTRY_KEYWORDS) {
    if (pattern.test(lower)) {
      return asset;
    }
  }
  return null;
}
