import { restaurant, meal, extras } from '../../dist/restaurant.config.js';
import { baseCatalog } from '../../dist/demo-engine.js';

export const posItemId = (locationId,itemId) => `web-${locationId}--${itemId}`;
export function toPosMenu(item,location) {
  const modifiers = [];
  if (item.meal) modifiers.push({ id:'web-meal',name:'Gör till meny',min:0,max:1,options:meal.drinks.map((name,index) => ({ id:`meal-${index}`,name:`Meny · pommes + ${name}`,priceOre:meal.price })) });
  if (item.extras.length) modifiers.push({ id:'web-extras',name:'Lite extra kärlek',min:0,max:item.extras.length,options:item.extras.map(id => extras.find(extra => extra.id === id)).map(extra => ({ id:`extra-${extra.id}`,name:extra.name,priceOre:extra.price })) });
  if (item.removable.length) modifiers.push({ id:'web-remove',name:'Utan ingredienser',min:0,max:item.removable.length,options:item.removable.map((name,index) => ({ id:`omit-${index}`,name:`Utan ${name.toLowerCase()}`,priceOre:0 })) });
  return {
    id:posItemId(location.id,item.id),name:item.name,category:`${location.name} · ${item.category === 'burgers' ? 'Burgare' : item.category === 'sides' ? 'Sides' : 'Dryck'}`,
    description:item.description,priceOre:item.price,takeawayPriceOre:item.price,taxClass:'food',
    course:item.category === 'drinks' ? 'drink' : 'main',station:item.category === 'drinks' ? 'bar' : 'kitchen',
    kitchenSection:item.category === 'drinks' ? 'general' : 'hot',itemKind:'services',takeawayItemKind:'goods',
    available:true,example:true,modifiers,
  };
}
export function toPosAdd(order,line,index,version) {
  const item = baseCatalog.find(item => item.id === line.itemId);
  const location = restaurant.locations.find(location => location.id === order.locationId);
  return {
    key:`${order.id}:line:${index}`,version,action:'add',itemId:posItemId(order.locationId,line.itemId),quantity:line.quantity,guest:1,hold:false,
    modifiers:[...(line.isMeal ? [`meal-${meal.drinks.indexOf(line.drink)}`] : []),...line.extraIds.map(id => `extra-${id}`),...line.removed.map(name => `omit-${item.removable.indexOf(name)}`)],
    notes:`WEBB ${order.id} · ${location.name} · ${order.fulfillment === 'dine_in' ? 'ÄTA HÄR' : 'TAKEAWAY'} · ${order.requestedAt.replace('T',' kl. ')}`,
  };
}
