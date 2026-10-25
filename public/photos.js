// Legacy products keep their original cover until saved with a photo list.
export function productPhotos(product){return [...new Set((Array.isArray(product.images)?product.images:product.image?[product.image]:[]).filter(image=>typeof image==='string'&&image))];}
