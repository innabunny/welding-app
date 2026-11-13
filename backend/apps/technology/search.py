import re
from django.db.models import Q
from apps.materials.models import Material

def parse_query(query: str) -> dict:
    """Парсит строку запроса и извлекает параметры для фильтрации."""
    result = {}
    if not query:
        return result

    # 1. Ищем толщины
    thicknesses = re.findall(r'(\d+(?:[.,]\d+)?)\s*(?:мм|mm)?', query, re.IGNORECASE)
    if thicknesses:
        thicknesses = [float(t.replace(',', '.')) for t in thicknesses]
        result['thickness_min'] = min(thicknesses)
        result['thickness_max'] = max(thicknesses)

    # 2. Ищем материал в справочнике
    materials = list(Material.objects.values_list('marka', flat=True))
    lower_query = query.lower()
    
    for marka in materials:
        if marka.lower() in lower_query:
            result['material'] = marka
            break
    
    if 'material' not in result:
        for marka in materials:
            if any(w in lower_query for w in marka.lower().split() if len(w) > 3):
                result['material'] = marka
                break

    return result