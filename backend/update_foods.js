const { sequelize, Food } = require('./models/index.js');

const rawData = [
  { category: 'Protein', name: 'Whole Egg', serving: '1 piece', cals: 72, p: 6.3, c: 0.4, f: 4.8 },
  { category: 'Protein', name: 'Egg White', serving: '1 piece', cals: 17, p: 3.6, c: 0.2, f: 0.0 },
  { category: 'Protein', name: 'Chicken Breast (cooked)', serving: '100 g', cals: 165, p: 31, c: 0, f: 3.6 },
  { category: 'Protein', name: 'Chicken Curry', serving: '1 cup', cals: 250, p: 22, c: 8, f: 15 },
  { category: 'Protein', name: 'Grilled Chicken', serving: '100 g', cals: 170, p: 31, c: 0, f: 4 },
  { category: 'Protein', name: 'Fish (Seer/Tuna avg.)', serving: '100 g', cals: 150, p: 27, c: 0, f: 4 },
  { category: 'Protein', name: 'Fish Curry', serving: '1 cup', cals: 220, p: 20, c: 6, f: 12 },
  { category: 'Protein', name: 'Fish Fry', serving: '1 piece', cals: 280, p: 25, c: 6, f: 18 },
  { category: 'Protein', name: 'Beef Curry', serving: '1 cup', cals: 290, p: 22, c: 8, f: 20 },
  { category: 'Protein', name: 'Mutton Curry', serving: '1 cup', cals: 320, p: 23, c: 7, f: 23 },
  { category: 'Carbohydrate', name: 'White Rice (cooked)', serving: '100 g', cals: 130, p: 2.4, c: 28, f: 0.3 },
  { category: 'Carbohydrate', name: 'Kerala Matta Rice', serving: '100 g', cals: 112, p: 2.6, c: 24, f: 0.8 },
  { category: 'Carbohydrate', name: 'Brown Rice', serving: '100 g', cals: 111, p: 2.6, c: 23, f: 0.9 },
  { category: 'Carbohydrate', name: 'Oats', serving: '50 g', cals: 190, p: 6.5, c: 33, f: 3.5 },
  { category: 'Carbohydrate', name: 'Sweet Potato', serving: '100 g', cals: 86, p: 1.6, c: 20, f: 0.1 },
  { category: 'Fruit', name: 'Banana', serving: '1 medium', cals: 105, p: 1.3, c: 27, f: 0.3 },
  { category: 'Fruit', name: 'Apple', serving: '1 medium', cals: 95, p: 0.5, c: 25, f: 0.3 },
  { category: 'Dairy', name: 'Milk (250 ml)', serving: '250 ml', cals: 150, p: 8, c: 12, f: 8 },
  { category: 'Dairy', name: 'Paneer', serving: '100 g', cals: 265, p: 18, c: 4, f: 21 },
  { category: 'Dairy', name: 'Greek Yogurt', serving: '100 g', cals: 97, p: 10, c: 4, f: 5 },
  { category: 'Healthy Fat', name: 'Peanut Butter', serving: '1 tbsp', cals: 94, p: 4, c: 3, f: 8 },
  { category: 'Supplement', name: 'Whey Protein', serving: '1 scoop', cals: 120, p: 24, c: 3, f: 1.5 },
  
  // Kerala Breakfast
  { category: 'Carbohydrate', name: 'Appam', serving: '1 piece', cals: 120, p: 2, c: 25, f: 2 },
  { category: 'Carbohydrate', name: 'Puttu', serving: '1 cylinder', cals: 320, p: 6, c: 70, f: 2 },
  { category: 'Protein', name: 'Kadala Curry', serving: '1 cup', cals: 220, p: 10, c: 25, f: 8 },
  { category: 'Carbohydrate', name: 'Idiyappam', serving: '2 piece', cals: 160, p: 4, c: 36, f: 0 },
  { category: 'Carbohydrate', name: 'Dosa', serving: '1 piece', cals: 133, p: 3, c: 18, f: 5 },
  { category: 'Carbohydrate', name: 'Masala Dosa', serving: '1 piece', cals: 250, p: 6, c: 32, f: 10 },
  { category: 'Carbohydrate', name: 'Idli', serving: '2 piece', cals: 116, p: 4, c: 24, f: 1 },
  { category: 'Carbohydrate', name: 'Chapati', serving: '1 piece', cals: 120, p: 4, c: 20, f: 3 },
  { category: 'Carbohydrate', name: 'Parotta', serving: '1 piece', cals: 280, p: 5, c: 38, f: 12 },
  { category: 'Carbohydrate', name: 'Poori', serving: '2 piece', cals: 220, p: 5, c: 24, f: 10 },
  { category: 'Carbohydrate', name: 'Upma', serving: '1 cup', cals: 220, p: 5, c: 32, f: 8 },

  // Kerala Lunch Items
  { category: 'Vegetable', name: 'Sambar', serving: '1 cup', cals: 140, p: 6, c: 18, f: 4 },
  { category: 'Vegetable', name: 'Rasam', serving: '1 cup', cals: 40, p: 2, c: 6, f: 1 },
  { category: 'Vegetable', name: 'Avial', serving: '1 cup', cals: 180, p: 4, c: 14, f: 12 },
  { category: 'Vegetable', name: 'Thoran', serving: '1 cup', cals: 120, p: 3, c: 10, f: 8 },
  { category: 'Vegetable', name: 'Moru Curry', serving: '1 cup', cals: 110, p: 4, c: 8, f: 7 },
  { category: 'Vegetable', name: 'Vegetable Curry', serving: '1 cup', cals: 130, p: 4, c: 16, f: 6 },

  // Fruits
  { category: 'Fruit', name: 'Banana', serving: '1 medium', cals: 105, p: 1, c: 27, f: 0 },
  { category: 'Fruit', name: 'Nendran Banana', serving: '1 medium', cals: 140, p: 2, c: 36, f: 0 },
  { category: 'Fruit', name: 'Mango', serving: '1 medium', cals: 135, p: 1, c: 35, f: 1 },
  { category: 'Fruit', name: 'Papaya', serving: '100 g', cals: 43, p: 0.5, c: 11, f: 0 },
  { category: 'Fruit', name: 'Pineapple', serving: '100 g', cals: 50, p: 0.5, c: 13, f: 0 },
  { category: 'Fruit', name: 'Watermelon', serving: '100 g', cals: 30, p: 0.6, c: 8, f: 0 },
  { category: 'Fruit', name: 'Orange', serving: '1 medium', cals: 62, p: 1, c: 15, f: 0 },
  { category: 'Fruit', name: 'Guava', serving: '1 medium', cals: 68, p: 2.6, c: 14, f: 1 },
  { category: 'Fruit', name: 'Pomegranate', serving: '100 g', cals: 83, p: 1.7, c: 19, f: 1 },

  // Nuts
  { category: 'Healthy Fat', name: 'Almonds', serving: '30 g', cals: 174, p: 6, c: 6, f: 15 },
  { category: 'Healthy Fat', name: 'Cashews', serving: '30 g', cals: 166, p: 5, c: 9, f: 13 },
  { category: 'Healthy Fat', name: 'Walnuts', serving: '30 g', cals: 196, p: 5, c: 4, f: 20 },
  { category: 'Healthy Fat', name: 'Peanuts', serving: '30 g', cals: 170, p: 7, c: 6, f: 14 },

  // Gym Essentials
  { category: 'Supplement', name: 'Whey Protein', serving: '30 g', cals: 120, p: 24, c: 3, f: 1.5 },
  { category: 'Protein', name: 'Boiled Eggs (2)', serving: '2 eggs', cals: 144, p: 12.6, c: 0.8, f: 9.6 },
  { category: 'Protein', name: 'Chicken Breast', serving: '200 g', cals: 330, p: 62, c: 0, f: 7 },
  { category: 'Carbohydrate', name: 'Oats (50 g)', serving: '50 g', cals: 190, p: 6.5, c: 33, f: 3.5 },
  { category: 'Carbohydrate', name: 'Brown Bread', serving: '2 slices', cals: 140, p: 6, c: 24, f: 2 },
  { category: 'Healthy Fat', name: 'Peanut Butter', serving: '2 tbsp', cals: 188, p: 8, c: 6, f: 16 },
];

function parseServing(servingStr) {
    const parts = servingStr.trim().split(' ');
    const size = parseFloat(parts[0]);
    const unit = parts.slice(1).join(' ');
    return { size: isNaN(size) ? 1 : size, unit: unit || 'piece' };
}

async function updateFoods() {
  await sequelize.sync({ alter: true });
  console.log('DB Synced. Updating foods...');

  try {
    for (const data of rawData) {
      const { size, unit } = parseServing(data.serving);
      
      const foodObj = {
        facilityId: null,
        name: data.name,
        category: data.category,
        servingSize: size,
        servingUnit: unit,
        calories: data.cals,
        protein: data.p,
        carbs: data.c,
        fat: data.f,
        fiber: 0,
        sugar: 0,
        sodium: 0
      };

      const existing = await Food.findOne({ where: { name: data.name, facilityId: null } });
      
      if (existing) {
        await existing.update(foodObj);
        console.log(`Updated: ${data.name}`);
      } else {
        await Food.create(foodObj);
        console.log(`Created: ${data.name}`);
      }
    }
    console.log('Update completed successfully!');
  } catch (error) {
    console.error('Update Error:', error);
  } finally {
    process.exit(0);
  }
}

updateFoods();
