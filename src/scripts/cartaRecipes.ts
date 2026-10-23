import type { MeasurementUnit } from "../types/enums";

export type CartaIngredientSeed = {
  name: string;
  unit: MeasurementUnit;
};

export type CartaRecipeSeed = {
  name: string;
  presentation: string;
  items: Array<{ ingredient: string; quantity: number }>;
};

export const CARTA_INGREDIENTS: CartaIngredientSeed[] = [
  { name: "Lomo fino de res", unit: "kg" },
  { name: "Cuadril de lomo", unit: "kg" },
  { name: "Chuleta de cerdo", unit: "kg" },
  { name: "Bife de chorizo", unit: "kg" },
  { name: "Baby beef", unit: "kg" },
  { name: "Entraña", unit: "kg" },
  { name: "Asado de tira", unit: "kg" },
  { name: "Lomo de res jr.", unit: "unidad" },
  { name: "Chuleta de cerdo jr.", unit: "unidad" },
  { name: "Filete de pollo", unit: "unidad" },
  { name: "1/4 pollo (pierna)", unit: "unidad" },
  { name: "1/4 pollo (pecho)", unit: "unidad" },
  { name: "1/2 pollo", unit: "unidad" },
  { name: "Pollo entero", unit: "unidad" },
  { name: "Pollo (brocheta)", unit: "unidad" },
  { name: "Anticucho", unit: "unidad" },
  { name: "Chorizo", unit: "unidad" },
  { name: "Morcilla", unit: "unidad" },
  { name: "Chinchulines", unit: "unidad" },
  { name: "Mollejitas de pollo", unit: "unidad" },
  { name: "Riñón", unit: "unidad" },
  { name: "Huevo frito", unit: "unidad" },
  { name: "Papas fritas", unit: "unidad" },
  { name: "Arroz blanco", unit: "unidad" },
  { name: "Tacu tacu", unit: "unidad" },
  { name: "Plátano frito", unit: "unidad" },
  { name: "Porción de choclo", unit: "unidad" },
  { name: "Porción de frejol", unit: "unidad" },
  { name: "Ensalada", unit: "unidad" },
  { name: "Salsa criolla", unit: "unidad" },
  { name: "Pimiento", unit: "unidad" },
  { name: "Cebolla", unit: "unidad" },
  { name: "Apio", unit: "unidad" },
  { name: "Gaseosa vaso", unit: "unidad" },
];

const half = (
  items: Array<{ ingredient: string; quantity: number }>
): Array<{ ingredient: string; quantity: number }> =>
  items.map((item) => ({ ...item, quantity: Number((item.quantity / 2).toFixed(3)) }));

const papasEnsalada = [
  { ingredient: "Papas fritas", quantity: 1 },
  { ingredient: "Ensalada", quantity: 1 },
];

const apanadoCompleto = [
  { ingredient: "Lomo fino de res", quantity: 0.25 },
  { ingredient: "Tacu tacu", quantity: 1 },
  { ingredient: "Plátano frito", quantity: 1 },
  { ingredient: "Huevo frito", quantity: 1 },
  { ingredient: "Salsa criolla", quantity: 1 },
];

export const CARTA_RECIPES: CartaRecipeSeed[] = [
  {
    name: "Anticuchos",
    presentation: "Porción de 3 palitos",
    items: [
      { ingredient: "Anticucho", quantity: 3 },
      { ingredient: "Porción de choclo", quantity: 1 },
      { ingredient: "Papas fritas", quantity: 1 },
    ],
  },
  {
    name: "Anticucho",
    presentation: "Unidad",
    items: [{ ingredient: "Anticucho", quantity: 1 }],
  },
  {
    name: "Piqueo",
    presentation: "Plato",
    items: [
      { ingredient: "Chinchulines", quantity: 1 },
      { ingredient: "Mollejitas de pollo", quantity: 1 },
      { ingredient: "Morcilla", quantity: 1 },
      { ingredient: "Chorizo", quantity: 1 },
    ],
  },
  {
    name: "Brocheta de pollo",
    presentation: "Brocheta",
    items: [
      { ingredient: "Pollo (brocheta)", quantity: 1 },
      { ingredient: "Pimiento", quantity: 1 },
      { ingredient: "Cebolla", quantity: 1 },
      { ingredient: "Apio", quantity: 1 },
      { ingredient: "Porción de choclo", quantity: 1 },
    ],
  },
  {
    name: "Chorizo al plato",
    presentation: "Unidad",
    items: [{ ingredient: "Chorizo", quantity: 1 }],
  },
  {
    name: "Morcilla al plato",
    presentation: "Unidad",
    items: [{ ingredient: "Morcilla", quantity: 1 }],
  },
  {
    name: "Mollejitas de pollo",
    presentation: "Porción",
    items: [{ ingredient: "Mollejitas de pollo", quantity: 1 }],
  },
  {
    name: "Chinchulines",
    presentation: "Porción",
    items: [{ ingredient: "Chinchulines", quantity: 1 }],
  },
  {
    name: "Chinchulines",
    presentation: "1/2 porción",
    items: [{ ingredient: "Chinchulines", quantity: 0.5 }],
  },
  {
    name: "Riñón",
    presentation: "Porción",
    items: [{ ingredient: "Riñón", quantity: 1 }],
  },
  {
    name: "Riñón",
    presentation: "1/2 porción",
    items: [{ ingredient: "Riñón", quantity: 0.5 }],
  },
  {
    name: "Mini parrilla",
    presentation: "Combo",
    items: [
      { ingredient: "Lomo de res jr.", quantity: 1 },
      { ingredient: "Chuleta de cerdo jr.", quantity: 1 },
      { ingredient: "Chorizo", quantity: 1 },
      { ingredient: "1/4 pollo (pierna)", quantity: 1 },
      { ingredient: "Anticucho", quantity: 1 },
      { ingredient: "Chinchulines", quantity: 1 },
      { ingredient: "Papas fritas", quantity: 1 },
    ],
  },
  {
    name: "Gran parrillada Timbó",
    presentation: "Combo",
    items: [
      { ingredient: "1/4 pollo (pierna)", quantity: 1 },
      { ingredient: "Chuleta de cerdo jr.", quantity: 2 },
      { ingredient: "Lomo de res jr.", quantity: 2 },
      { ingredient: "Chorizo", quantity: 1 },
      { ingredient: "Morcilla", quantity: 1 },
      { ingredient: "Chinchulines", quantity: 1 },
      { ingredient: "Mollejitas de pollo", quantity: 1 },
      { ingredient: "Anticucho", quantity: 2 },
      { ingredient: "Papas fritas", quantity: 1 },
    ],
  },
  {
    name: "Parrillada familiar",
    presentation: "Combo",
    items: [
      { ingredient: "1/2 pollo", quantity: 1 },
      { ingredient: "Chuleta de cerdo jr.", quantity: 3 },
      { ingredient: "Lomo de res jr.", quantity: 3 },
      { ingredient: "Chorizo", quantity: 3 },
      { ingredient: "Morcilla", quantity: 3 },
      { ingredient: "Chinchulines", quantity: 1 },
      { ingredient: "Mollejitas de pollo", quantity: 1 },
      { ingredient: "Anticucho", quantity: 6 },
      { ingredient: "Papas fritas", quantity: 1 },
      { ingredient: "Ensalada", quantity: 1 },
    ],
  },
  {
    name: "Lomo fino de res",
    presentation: "300 g",
    items: [{ ingredient: "Lomo fino de res", quantity: 0.3 }],
  },
  {
    name: "Lomo fino de res",
    presentation: "400 g",
    items: [{ ingredient: "Lomo fino de res", quantity: 0.4 }],
  },
  {
    name: "Cuadril de lomo",
    presentation: "300 g",
    items: [{ ingredient: "Cuadril de lomo", quantity: 0.3 }],
  },
  {
    name: "Cuadril de lomo",
    presentation: "400 g",
    items: [{ ingredient: "Cuadril de lomo", quantity: 0.4 }],
  },
  {
    name: "Chuleta de cerdo",
    presentation: "400 g",
    items: [{ ingredient: "Chuleta de cerdo", quantity: 0.4 }],
  },
  {
    name: "Filete de pollo",
    presentation: "Porción",
    items: [{ ingredient: "Filete de pollo", quantity: 1 }],
  },
  {
    name: "1/2 filete de pollo",
    presentation: "1/2 porción",
    items: [{ ingredient: "Filete de pollo", quantity: 0.5 }],
  },
  {
    name: "Bife de chorizo",
    presentation: "300 g",
    items: [{ ingredient: "Bife de chorizo", quantity: 0.3 }],
  },
  {
    name: "Bife de chorizo",
    presentation: "400 g",
    items: [{ ingredient: "Bife de chorizo", quantity: 0.4 }],
  },
  {
    name: "Baby beef",
    presentation: "300 g",
    items: [{ ingredient: "Baby beef", quantity: 0.3 }],
  },
  {
    name: "Baby beef",
    presentation: "400 g",
    items: [{ ingredient: "Baby beef", quantity: 0.4 }],
  },
  {
    name: "Churrasco al Timbó",
    presentation: "Plato",
    items: [
      { ingredient: "Bife de chorizo", quantity: 0.3 },
      { ingredient: "Arroz blanco", quantity: 1 },
      { ingredient: "Huevo frito", quantity: 1 },
      { ingredient: "Papas fritas", quantity: 1 },
    ],
  },
  {
    name: "Entraña",
    presentation: "450 g",
    items: [{ ingredient: "Entraña", quantity: 0.45 }],
  },
  {
    name: "Asado de tira",
    presentation: "600 g",
    items: [{ ingredient: "Asado de tira", quantity: 0.6 }],
  },
  {
    name: "1/4 pollo (pierna)",
    presentation: "1/4 pollo",
    items: [
      { ingredient: "1/4 pollo (pierna)", quantity: 1 },
      ...papasEnsalada,
    ],
  },
  {
    name: "1/4 pollo (pecho)",
    presentation: "1/4 pollo",
    items: [
      { ingredient: "1/4 pollo (pecho)", quantity: 1 },
      ...papasEnsalada,
    ],
  },
  {
    name: "1/2 pollo",
    presentation: "1/2 pollo",
    items: [{ ingredient: "1/2 pollo", quantity: 1 }, ...papasEnsalada],
  },
  {
    name: "Pollo entero",
    presentation: "1 pollo",
    items: [{ ingredient: "Pollo entero", quantity: 1 }, ...papasEnsalada],
  },
  {
    name: "Apanado al Timbó",
    presentation: "Completo",
    items: apanadoCompleto,
  },
  {
    name: "Apanado al Timbó",
    presentation: "Medio",
    items: half(apanadoCompleto),
  },
  {
    name: "Filete de pollo, papas fritas, ensalada y 1 vaso de gaseosa",
    presentation: "Menú",
    items: [
      { ingredient: "Filete de pollo", quantity: 1 },
      { ingredient: "Papas fritas", quantity: 1 },
      { ingredient: "Ensalada", quantity: 1 },
      { ingredient: "Gaseosa vaso", quantity: 1 },
    ],
  },
  {
    name: "Papas fritas",
    presentation: "Porción",
    items: [{ ingredient: "Papas fritas", quantity: 1 }],
  },
  {
    name: "Papas fritas",
    presentation: "1/2 porción",
    items: [{ ingredient: "Papas fritas", quantity: 0.5 }],
  },
  {
    name: "Arroz blanco",
    presentation: "Porción",
    items: [{ ingredient: "Arroz blanco", quantity: 1 }],
  },
  {
    name: "Porción de frejol",
    presentation: "Porción",
    items: [{ ingredient: "Porción de frejol", quantity: 1 }],
  },
  {
    name: "Huevo frito",
    presentation: "Unidad",
    items: [{ ingredient: "Huevo frito", quantity: 1 }],
  },
  {
    name: "Tacu tacu",
    presentation: "Porción",
    items: [{ ingredient: "Tacu tacu", quantity: 1 }],
  },
  {
    name: "Porción de choclo",
    presentation: "Porción",
    items: [{ ingredient: "Porción de choclo", quantity: 1 }],
  },
  {
    name: "Plátano frito",
    presentation: "Porción",
    items: [{ ingredient: "Plátano frito", quantity: 1 }],
  },
];
