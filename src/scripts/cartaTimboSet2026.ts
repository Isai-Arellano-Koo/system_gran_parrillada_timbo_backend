export type CartaDishSeed = {
  category: string;
  name: string;
  presentation: string;
  price: number;
  description: string | null;
};

export const CARTA_CATEGORIES: string[] = 
[
  "Promociones",
  "Cócteles",
  "Licores y vinos",
  "Vinos importados - argentinos",
  "Vinos importados - chilenos",
  "Ensaladas",
  "Sopas",
  "Guarniciones",
  "Menú especial",
  "Entradas - anticuchos",
  "Entradas - piqueos y achuras",
  "Parrillas",
  "Parrilla convencional - nacional",
  "Parrilla convencional - americano",
  "Pollos al fogón",
  "Nuestra cocina",
  "Cafetería",
  "Bebidas",
  "Postres"
];

export const CARTA_DISHES: CartaDishSeed[] = 
[
  {
    "category": "Promociones",
    "name": "Happy Hour: 2 cócteles locales",
    "presentation": "2 unidades",
    "price": 36.0,
    "description": "Todos los días, todo el día. Aplica únicamente a cócteles locales."
  },
  {
    "category": "Cócteles",
    "name": "Timbó",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Triana",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Pueblo Libre",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Bolívar",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Pisco Sour",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Piña Colada",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Algarrobina",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Daiquiri",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Chilcano de Pisco",
    "presentation": "1 cóctel",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Cócteles",
    "name": "Tinto de Verano",
    "presentation": "1 cóctel",
    "price": 24.0,
    "description": null
  },
  {
    "category": "Licores y vinos",
    "name": "Cerveza (Pilsen, Cristal, Cusqueña o Corona)",
    "presentation": "Botella",
    "price": 14.0,
    "description": null
  },
  {
    "category": "Licores y vinos",
    "name": "Jarra de sangría",
    "presentation": "Jarra",
    "price": 68.0,
    "description": null
  },
  {
    "category": "Licores y vinos",
    "name": "1/2 jarra de sangría",
    "presentation": "1/2 jarra",
    "price": 58.0,
    "description": null
  },
  {
    "category": "Licores y vinos",
    "name": "Fon de Cave Malbec",
    "presentation": "Botella",
    "price": 60.0,
    "description": "Nombre transcrito tal como aparece en la carta."
  },
  {
    "category": "Licores y vinos",
    "name": "Tacama Gran Tinto Malbec",
    "presentation": "Botella",
    "price": 60.0,
    "description": null
  },
  {
    "category": "Licores y vinos",
    "name": "Tacama Rosé Semi Seco",
    "presentation": "Botella",
    "price": 55.0,
    "description": null
  },
  {
    "category": "Licores y vinos",
    "name": "Tacama Selección Especial",
    "presentation": "Botella",
    "price": 90.0,
    "description": null
  },
  {
    "category": "Vinos importados - argentinos",
    "name": "Rutini Encuentro Malbec",
    "presentation": "Botella 750 ml",
    "price": 145.0,
    "description": null
  },
  {
    "category": "Vinos importados - argentinos",
    "name": "Navarro Colección Privada Malbec",
    "presentation": "Botella 750 ml",
    "price": 110.0,
    "description": null
  },
  {
    "category": "Vinos importados - argentinos",
    "name": "Trivento Reserva Malbec",
    "presentation": "Botella 750 ml",
    "price": 90.0,
    "description": null
  },
  {
    "category": "Vinos importados - chilenos",
    "name": "Montes Classic Merlot",
    "presentation": "Botella 750 ml",
    "price": 110.0,
    "description": null
  },
  {
    "category": "Vinos importados - chilenos",
    "name": "Montes Classic Malbec",
    "presentation": "Botella 750 ml",
    "price": 110.0,
    "description": null
  },
  {
    "category": "Vinos importados - chilenos",
    "name": "Errazuriz Estate Cabernet Sauvignon",
    "presentation": "Botella 750 ml",
    "price": 90.0,
    "description": null
  },
  {
    "category": "Ensaladas",
    "name": "Mixta especial",
    "presentation": "Porción",
    "price": 29.9,
    "description": null
  },
  {
    "category": "Ensaladas",
    "name": "Mixta especial",
    "presentation": "1/2 porción",
    "price": 20.9,
    "description": null
  },
  {
    "category": "Ensaladas",
    "name": "Ensalada de berros",
    "presentation": "Porción",
    "price": 20.9,
    "description": null
  },
  {
    "category": "Ensaladas",
    "name": "Ensalada de palta",
    "presentation": "Porción",
    "price": 22.9,
    "description": null
  },
  {
    "category": "Ensaladas",
    "name": "Ensalada de legumbres cocidas",
    "presentation": "Porción",
    "price": 29.9,
    "description": null
  },
  {
    "category": "Sopas",
    "name": "Dieta de pollo",
    "presentation": "Porción",
    "price": 25.0,
    "description": null
  },
  {
    "category": "Sopas",
    "name": "Sopa sustancia",
    "presentation": "Porción",
    "price": 28.0,
    "description": null
  },
  {
    "category": "Sopas",
    "name": "Sopa criolla",
    "presentation": "Porción",
    "price": 30.0,
    "description": null
  },
  {
    "category": "Sopas",
    "name": "Sancochado especial",
    "presentation": "Porción",
    "price": 37.9,
    "description": null
  },
  {
    "category": "Sopas",
    "name": "Consomé de sancochado",
    "presentation": "Porción",
    "price": 17.0,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Papas fritas",
    "presentation": "1/2 porción",
    "price": 17.0,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Papas fritas",
    "presentation": "Porción",
    "price": 26.0,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Arroz blanco",
    "presentation": "Porción",
    "price": 7.9,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Porción de frejol",
    "presentation": "Porción",
    "price": 8.9,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Huevo frito",
    "presentation": "Unidad",
    "price": 6.0,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Tacu tacu",
    "presentation": "Porción",
    "price": 15.0,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Porción de choclo",
    "presentation": "Porción",
    "price": 7.9,
    "description": null
  },
  {
    "category": "Guarniciones",
    "name": "Plátano frito",
    "presentation": "Porción",
    "price": 6.9,
    "description": null
  },
  {
    "category": "Menú especial",
    "name": "Filete de pollo, papas fritas, ensalada y 1 vaso de gaseosa",
    "presentation": "Menú",
    "price": 29.0,
    "description": "De lunes a viernes, de 12:00 a 16:00. No aplica feriados ni días festivos."
  },
  {
    "category": "Entradas - anticuchos",
    "name": "Anticuchos",
    "presentation": "Porción de 3 palitos",
    "price": 34.0,
    "description": "Incluye choclo y papas fritas."
  },
  {
    "category": "Entradas - anticuchos",
    "name": "Anticucho",
    "presentation": "Unidad",
    "price": 15.0,
    "description": null
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Piqueo",
    "presentation": "Plato",
    "price": 41.0,
    "description": "Chinchulines, molleja de pollo, morcilla y chorizo."
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Brocheta de pollo",
    "presentation": "Brocheta",
    "price": 28.0,
    "description": "Pollo, pimiento, cebolla, apio y choclo."
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Chorizo al plato",
    "presentation": "Unidad",
    "price": 11.0,
    "description": null
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Morcilla al plato",
    "presentation": "Unidad",
    "price": 11.0,
    "description": null
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Mollejitas de pollo",
    "presentation": "Porción",
    "price": 24.0,
    "description": null
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Chinchulines",
    "presentation": "Porción",
    "price": 28.9,
    "description": null
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Chinchulines",
    "presentation": "1/2 porción",
    "price": 19.9,
    "description": null
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Riñón",
    "presentation": "Porción",
    "price": 24.0,
    "description": null
  },
  {
    "category": "Entradas - piqueos y achuras",
    "name": "Riñón",
    "presentation": "1/2 porción",
    "price": 14.0,
    "description": null
  },
  {
    "category": "Parrillas",
    "name": "Mini parrilla",
    "presentation": "Combo",
    "price": 88.0,
    "description": "Lomo de res jr., chuleta de cerdo jr., chorizo, 1/4 pollo (pierna), anticucho, chinchulines y papas fritas."
  },
  {
    "category": "Parrillas",
    "name": "Gran parrillada Timbó",
    "presentation": "Combo",
    "price": 131.9,
    "description": "1/4 pollo (pierna), 2 chuletas de cerdo jr., 2 lomos de res jr., chorizo, morcilla, chinchulines, mollejitas de pollo, 2 anticuchos y papas fritas."
  },
  {
    "category": "Parrillas",
    "name": "Parrillada familiar",
    "presentation": "Combo",
    "price": 235.0,
    "description": "1/2 pollo, 3 chuletas de cerdo jr., 3 lomos de res jr., 3 chorizos, 3 morcillas, chinchulines, mollejitas de pollo, 6 anticuchos, papas fritas y ensalada."
  },
  {
    "category": "Parrilla convencional - nacional",
    "name": "Lomo fino de res",
    "presentation": "300 g",
    "price": 52.0,
    "description": null
  },
  {
    "category": "Parrilla convencional - nacional",
    "name": "Lomo fino de res",
    "presentation": "400 g",
    "price": 69.0,
    "description": null
  },
  {
    "category": "Parrilla convencional - nacional",
    "name": "Cuadril de lomo",
    "presentation": "300 g",
    "price": 52.0,
    "description": null
  },
  {
    "category": "Parrilla convencional - nacional",
    "name": "Cuadril de lomo",
    "presentation": "400 g",
    "price": 69.0,
    "description": null
  },
  {
    "category": "Parrilla convencional - nacional",
    "name": "Chuleta de cerdo",
    "presentation": "400 g",
    "price": 42.9,
    "description": null
  },
  {
    "category": "Parrilla convencional - nacional",
    "name": "Filete de pollo",
    "presentation": "Porción",
    "price": 39.9,
    "description": "La carta no especifica gramaje."
  },
  {
    "category": "Parrilla convencional - nacional",
    "name": "1/2 filete de pollo",
    "presentation": "1/2 porción",
    "price": 30.9,
    "description": null
  },
  {
    "category": "Parrilla convencional - americano",
    "name": "Bife de chorizo",
    "presentation": "300 g",
    "price": 65.0,
    "description": null
  },
  {
    "category": "Parrilla convencional - americano",
    "name": "Bife de chorizo",
    "presentation": "400 g",
    "price": 79.9,
    "description": null
  },
  {
    "category": "Parrilla convencional - americano",
    "name": "Baby beef",
    "presentation": "300 g",
    "price": 69.9,
    "description": null
  },
  {
    "category": "Parrilla convencional - americano",
    "name": "Baby beef",
    "presentation": "400 g",
    "price": 88.9,
    "description": null
  },
  {
    "category": "Parrilla convencional - americano",
    "name": "Churrasco al Timbó",
    "presentation": "Plato",
    "price": 67.9,
    "description": "Bife, arroz, huevo frito y papas fritas."
  },
  {
    "category": "Parrilla convencional - americano",
    "name": "Entraña",
    "presentation": "450 g",
    "price": 136.0,
    "description": null
  },
  {
    "category": "Parrilla convencional - americano",
    "name": "Asado de tira",
    "presentation": "600 g",
    "price": 136.0,
    "description": null
  },
  {
    "category": "Pollos al fogón",
    "name": "1/4 pollo (pierna)",
    "presentation": "1/4 pollo",
    "price": 32.0,
    "description": "Incluye papas fritas y ensalada."
  },
  {
    "category": "Pollos al fogón",
    "name": "1/4 pollo (pecho)",
    "presentation": "1/4 pollo",
    "price": 35.0,
    "description": "Incluye papas fritas y ensalada."
  },
  {
    "category": "Pollos al fogón",
    "name": "1/2 pollo",
    "presentation": "1/2 pollo",
    "price": 53.9,
    "description": "Incluye papas fritas y ensalada."
  },
  {
    "category": "Pollos al fogón",
    "name": "Pollo entero",
    "presentation": "1 pollo",
    "price": 87.9,
    "description": "Incluye papas fritas y ensalada."
  },
  {
    "category": "Nuestra cocina",
    "name": "Apanado al Timbó",
    "presentation": "Completo",
    "price": 65.0,
    "description": "Lomo fino apanado, tacu tacu, plátano frito, huevo frito y salsa criolla."
  },
  {
    "category": "Nuestra cocina",
    "name": "Apanado al Timbó",
    "presentation": "Medio",
    "price": 48.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Lomo fino saltado a la criolla",
    "presentation": "Porción",
    "price": 59.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Lomo fino saltado a la criolla",
    "presentation": "1/2 porción",
    "price": 40.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Pollo saltado a la criolla",
    "presentation": "Porción",
    "price": 48.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Pollo saltado a la criolla",
    "presentation": "1/2 porción",
    "price": 37.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Suprema de pollo",
    "presentation": "Porción",
    "price": 47.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Suprema de pollo",
    "presentation": "1/2 porción",
    "price": 34.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Milanesa de lomo fino",
    "presentation": "Porción",
    "price": 59.9,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Milanesa de lomo fino",
    "presentation": "1/2 porción",
    "price": 40.0,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Filet mignon",
    "presentation": "Porción",
    "price": 69.9,
    "description": null
  },
  {
    "category": "Nuestra cocina",
    "name": "Lomo a la pimienta",
    "presentation": "Porción",
    "price": 69.0,
    "description": null
  },
  {
    "category": "Cafetería",
    "name": "Café expreso",
    "presentation": "Taza",
    "price": 9.0,
    "description": null
  },
  {
    "category": "Cafetería",
    "name": "Café americano",
    "presentation": "Taza",
    "price": 9.0,
    "description": null
  },
  {
    "category": "Cafetería",
    "name": "Café cortado",
    "presentation": "Taza",
    "price": 9.0,
    "description": null
  },
  {
    "category": "Cafetería",
    "name": "Capuccino",
    "presentation": "Taza",
    "price": 12.0,
    "description": null
  },
  {
    "category": "Cafetería",
    "name": "Infusiones",
    "presentation": "Taza",
    "price": 7.0,
    "description": null
  },
  {
    "category": "Bebidas",
    "name": "Limonada / chicha",
    "presentation": "Jarra",
    "price": 24.0,
    "description": null
  },
  {
    "category": "Bebidas",
    "name": "Limonada / chicha",
    "presentation": "1/2 jarra",
    "price": 17.0,
    "description": null
  },
  {
    "category": "Bebidas",
    "name": "Limonada / chicha",
    "presentation": "Vaso",
    "price": 9.0,
    "description": null
  },
  {
    "category": "Bebidas",
    "name": "Gaseosa",
    "presentation": "500 ml",
    "price": 8.5,
    "description": null
  },
  {
    "category": "Bebidas",
    "name": "Milkshake",
    "presentation": "Vaso",
    "price": 14.5,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Tres leches",
    "presentation": "Porción",
    "price": 14.5,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Cheesecake de sauco",
    "presentation": "Porción",
    "price": 14.5,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Dulce de lúcuma",
    "presentation": "Porción",
    "price": 14.5,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Sublime de chocolate",
    "presentation": "Porción",
    "price": 14.5,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Suspiro limeño",
    "presentation": "Porción",
    "price": 14.5,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Panqueque simple",
    "presentation": "Porción",
    "price": 16.0,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Panqueque especial",
    "presentation": "Porción",
    "price": 24.0,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Helado",
    "presentation": "1 bola",
    "price": 6.0,
    "description": null
  },
  {
    "category": "Postres",
    "name": "Porción de helado",
    "presentation": "3 bolas",
    "price": 14.0,
    "description": null
  }
];
