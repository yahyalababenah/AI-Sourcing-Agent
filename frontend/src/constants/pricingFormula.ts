/** Variables available inside a "formula"-type pricing rule, evaluated per shipment line.
 * Must mirror app/modules/pricing/formula.py:FORMULA_VARIABLES exactly. */
export const FORMULA_VARIABLES: { name: string; label: string }[] = [
  { name: "unit_price_cny", label: "سعر الوحدة (يوان)" },
  { name: "unit_price_usd", label: "سعر الوحدة (دولار)" },
  { name: "unit_price_local", label: "سعر الوحدة (بالعملة المستهدفة)" },
  { name: "quantity", label: "الكمية" },
  { name: "weight_kg", label: "وزن الوحدة (كغ)" },
  { name: "total_weight_kg", label: "الوزن الإجمالي (كغ)" },
  { name: "cbm", label: "الحجم التقديري (CBM)" },
  { name: "freight", label: "تكلفة الشحن للسطر" },
  { name: "insurance", label: "تكلفة التأمين للسطر" },
  { name: "cif", label: "قيمة CIF للسطر" },
  { name: "customs", label: "الرسوم الجمركية للسطر" },
  { name: "clearance", label: "رسوم التخليص للسطر" },
  { name: "commission", label: "العمولة للسطر" },
  { name: "exchange_rate", label: "سعر الصرف المستخدم" },
  { name: "subtotal", label: "المجموع الفرعي للسطر" },
  { name: "line_total", label: "إجمالي السطر" },
];

export const FORMULA_EXAMPLE = "max(50, cif * 0.02)";
