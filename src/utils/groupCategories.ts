export interface Category {
  id: string;
  name: string;
  groupId?: string;
  [key: string]: any;
}

export interface CategoryGroup {
  id: string;
  name: string;
  categories: Category[];
}

/**
 * Agrupa categorias em uma ordem estável (first-seen).
 * Retorna array de CategoryGroup; categorias sem grupo vão para 'Outros' se indicado.
 */
export function groupCategories(categories: Category[], options?: { othersLabel?: string }): CategoryGroup[] {
  const othersLabel = options?.othersLabel ?? 'Outros';
  const map = new Map<string, CategoryGroup>();

  for (const cat of categories) {
    const groupId = cat.groupId ?? othersLabel;
    if (!map.has(groupId)) {
      map.set(groupId, {
        id: groupId,
        name: groupId === othersLabel ? othersLabel : String(groupId),
        categories: [],
      });
    }
    map.get(groupId)!.categories.push(cat);
  }

  return Array.from(map.values());
}