/** Canonical product category buckets, mirroring app/shared/categories.py:CANONICAL_CATEGORIES. */
export const PRODUCT_CATEGORIES: { value: string; label: string }[] = [
  { value: "personal care", label: "العناية الشخصية" },
  { value: "food & beverage", label: "أغذية ومشروبات" },
  { value: "textiles", label: "منسوجات" },
  { value: "plastic & rubber", label: "بلاستيك ومطاط" },
  { value: "electronics", label: "إلكترونيات" },
  { value: "machinery", label: "آلات ومعدات" },
  { value: "metal & hardware", label: "معادن وعِدد" },
  { value: "furniture", label: "أثاث" },
  { value: "paper & packaging", label: "ورق وتغليف" },
  { value: "chemicals", label: "كيماويات" },
  { value: "glass & ceramics", label: "زجاج وسيراميك" },
];

/** Arabic label for a category value; falls back to the raw value if unrecognized. */
export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
