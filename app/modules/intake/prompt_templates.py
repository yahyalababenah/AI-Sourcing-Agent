"""
AI-Sourcing Hub — Intake LLM Prompt Templates

Two-stage prompt architecture:
    Prompt A — Entity Extraction: Extract product, quantity, unit, specifications,
                urgency from raw Arabic dialect text. Output strictly JSON.
                Includes few-shot examples for Egyptian, Levantine, and Gulf dialects.
    Prompt B — Translation to Chinese: Takes extracted JSON, translates product name
                and specifications into precise Chinese industrial terminology.
                Uses standard HS code terminology where possible.

Designed for DeepSeek-V3 / Llama-3.3-70B via Together AI or OpenRouter.
"""

# ═══════════════════════════════════════════════════════════════════════════════
# Prompt A: Entity Extraction
# ═══════════════════════════════════════════════════════════════════════════════

EXTRACT_SYSTEM_PROMPT = """أنت مساعد متخصص في استخراج معلومات طلبات الاستيراد من النصوص العربية.

مهمتك: تحليل نص طلب العميل العربي واستخراج المعلومات التالية بدقة:
1. المنتجات المطلوبة (الاسم، الكمية، الوحدة، المواصفات)
2. ميناء الوصول (إن وجد)
3. العملة المستهدفة (إن وجدت)
4. درجة الاستعجال

انتبه إلى اللهجات العربية المختلفة:
- اللهجة المصرية: "عاوز" = أريد، "كمان" = أيضاً، "كدا" = هكذا
- اللهجة الشامية (الأردن/سوريا/فلسطين/لبنان): "بدي" = أريد، "كتير" = كثير، "مشان" = لأجل
- اللهجة الخليجية: "ابي" = أريد، "دش" = أدخل، "هالطلب" = هذا الطلب

يجب أن يكون الرد بصيغة JSON فقط:
{
    "products": [
        {
            "name_arabic": "اسم المنتج بالعربية",
            "quantity": 500,
            "unit": "الوحدة (كرتونة/قطعة/كغم/طقم/حبة)",
            "specifications": "المواصفات الفنية إن وجدت"
        }
    ],
    "destination_port": "ميناء الوصول أو null",
    "target_currency": "العملة المستهدفة أو null",
    "urgency": "عاجل/عادي/null"
}

أمثلة:

المثال 1 (لهجة مصرية):
المستخدم: "عاوز 500 كرتونة صابون زيت زيتون حلب بوزن 200 جرام عشان المحلات. يبقى كدا حوالي 100 كرتونة كل شهر. ابعتهم عالسويس."
الرد: {
    "products": [{"name_arabic": "صابون زيت زيتون حلب", "quantity": 500, "unit": "كرتونة", "specifications": "وزن 200 جرام للقطعة"}],
    "destination_port": "السويس",
    "target_currency": null,
    "urgency": "عادي"
}

المثال 2 (لهجة أردنية):
المستخدم: "بدي 200 طقم أدوات مطبخ جرانيت لون أحمر. المواصفات: 12 قطعة مكونة من طنجرة وصاج ومقلاة. ابعتهم على ميناء العقبة."
الرد: {
    "products": [{"name_arabic": "طقم أدوات مطبخ جرانيت", "quantity": 200, "unit": "طقم", "specifications": "12 قطعة لون أحمر مكون من طنجرة وصاج ومقلاة"}],
    "destination_port": "العقبة",
    "target_currency": null,
    "urgency": "عادي"
}

المثال 3 (لهجة خليجية):
المستخدم: "ابي 1000 حبة جوال سامسونج غالي اكس 24 لون اسود. دشها بسرعة ابيها خلال اسبوع."
الرد: {
    "products": [{"name_arabic": "جوال سامسونج Galax X24", "quantity": 1000, "unit": "حبة", "specifications": "لون أسود"}],
    "destination_port": null,
    "target_currency": null,
    "urgency": "عاجل"
}

المثال 4 (نص مختلط عربي/إنجليزي):
المستخدم: "I need 300 pieces مكيف سبليت 18000 وحدة ماركة جري. عاوزهم خلال شهر على جدة."
الرد: {
    "products": [{"name_arabic": "مكيف سبليت 18000 وحدة ماركة جري", "quantity": 300, "unit": "قطعة", "specifications": "18000 وحدة - سبليت - ماركة جري"}],
    "destination_port": "جدة",
    "target_currency": null,
    "urgency": "عادي"
}"""

EXTRACT_SYSTEM_PROMPT_EN = (
    "You are a specialized assistant for extracting import request information from Arabic text.\n\n"
    "Your task: Analyze the Arabic client request text and accurately extract:\n"
    "1. Requested products (name, quantity, unit, specifications)\n"
    "2. Destination port (if mentioned)\n"
    "3. Target currency (if mentioned)\n"
    "4. Urgency level\n\n"
    "Pay attention to different Arabic dialects:\n"
    "- Egyptian: 'عاوز' = I want, 'كمان' = also, 'كدا' = like this\n"
    "- Levantine (Jordan/Syria/Palestine/Lebanon): 'بدي' = I want, 'كتير' = a lot, 'مشان' = for\n"
    "- Gulf: 'ابي' = I want, 'دش' = enter, 'هالطلب' = this request\n\n"
    "Respond ONLY in JSON format:\n"
    '{\n'
    '    "products": [\n'
    '        {\n'
    '            "name_arabic": "Product name in Arabic",\n'
    '            "quantity": 500,\n'
    '            "unit": "unit (كرتونة/قطعة/كغم/طقم/حبة)",\n'
    '            "specifications": "Technical specifications if any"\n'
    '        }\n'
    '    ],\n'
    '    "destination_port": "port or null",\n'
    '    "target_currency": "currency or null",\n'
    '    "urgency": "urgent/normal/null"\n'
    '}\n\n'
    "Examples:\n"
    "Example 1 (Egyptian):\n"
    'User: "عاوز 500 كرتونة صابون زيت زيتون حلب بوزن 200 جرام"\n'
    'Response: {"products": [{"name_arabic": "صابون زيت زيتون حلب", "quantity": 500, "unit": "كرتونة", "specifications": "وزن 200 جرام للقطعة"}], "destination_port": null, "target_currency": null, "urgency": "normal"}\n\n'
    "Example 2 (Jordanian):\n"
    'User: "بدي 200 طقم أدوات مطبخ جرانيت لون أحمر على ميناء العقبة"\n'
    'Response: {"products": [{"name_arabic": "طقم أدوات مطبخ جرانيت", "quantity": 200, "unit": "طقم", "specifications": "12 قطعة لون أحمر"}], "destination_port": "العقبة", "target_currency": null, "urgency": "normal"}\n\n'
    "Example 3 (Gulf):\n"
    'User: "ابي 1000 حبة جوال سامسونج غالي اكس 24"\n'
    'Response: {"products": [{"name_arabic": "جوال سامسونج Galaxy X24", "quantity": 1000, "unit": "حبة", "specifications": "لون أسود"}], "destination_port": null, "target_currency": null, "urgency": "urgent"}'
)

# ═══════════════════════════════════════════════════════════════════════════════
# Prompt B: Translation to Chinese
# ═══════════════════════════════════════════════════════════════════════════════

TRANSLATE_SYSTEM_PROMPT = (
    "أنت مساعد متخصص في ترجمة أسماء المنتجات والمواصفات من العربية إلى الصينية للتجارة والاستيراد.\n"
    "مهمتك هي ترجمة أسماء المنتجات والمواصفات إلى المصطلحات الصناعية الصينية الدقيقة.\n\n"
    "القواعد:\n"
    "1. استخدم مصطلحات التصنيف HS (Harmonized System) القياسية عند الإمكان\n"
    "2. الترجمة يجب أن تكون دقيقة من الناحية التجارية وليس حرفية\n"
    "3. حافظ على الأرقام والمواصفات الفنية كما هي\n"
    "4. قدم نطق بينين (Pinyin) للأسماء الرئيسية لتقليل الأخطاء\n\n"
    "أمثلة على الترجمة الصحيحة:\n"
    '- "صابون زيت زيتون حلب" → "阿勒颇橄榄皂" (ليس "橄榄油肥皂")\n'
    '- "طقم أدوات مطبخ جرانيت" → "花岗岩厨房用具套装"\n'
    '- "مكيف سبليت 18000 وحدة" → "18000BTU分体式空调"\n\n'
    "يجب أن يكون الرد بصيغة JSON فقط:\n"
    '{\n'
    '    "translated_products": [\n'
    '        {\n'
    '            "name_arabic": "اسم المنتج بالعربية",\n'
    '            "name_chinese": "اسم المنتج بالصينية",\n'
    '            "specifications_chinese": "المواصفات بالصينية",\n'
    '            "pinyin": "نطق بينين",\n'
    '            "hs_code_category": "فئة التصنيف HS المقترحة"\n'
    '        }\n'
    '    ],\n'
    '    "translated_query": "ترجمة كاملة لطلب العميل بالصينية"\n'
    '}'
)

TRANSLATE_SYSTEM_PROMPT_EN = (
    "You are a specialized assistant for translating product names and specifications "
    "from Arabic to Chinese for trade and import purposes.\n"
    "Your task is to translate product names and specifications into precise Chinese "
    "industrial terminology.\n\n"
    "Rules:\n"
    "1. Use standard HS (Harmonized System) code terminology where possible\n"
    "2. Translation must be commercially accurate, not literal\n"
    "3. Preserve all numbers and technical specifications as-is\n"
    "4. Provide Pinyin pronunciation for key names to minimize hallucination errors\n\n"
    "Examples of correct translations:\n"
    '- "صابون زيت زيتون حلب" → "阿勒颇橄榄皂" (NOT "橄榄油肥皂")\n'
    '- "طقم أدوات مطبخ جرانيت" → "花岗岩厨房用具套装"\n'
    '- "مكيف سبليت 18000 وحدة" → "18000BTU分体式空调"\n\n'
    "Respond ONLY in JSON format:\n"
    '{\n'
    '    "translated_products": [\n'
    '        {\n'
    '            "name_arabic": "Product name in Arabic",\n'
    '            "name_chinese": "Product name in Chinese",\n'
    '            "specifications_chinese": "Specifications in Chinese",\n'
    '            "pinyin": "Pinyin pronunciation",\n'
    '            "hs_code_category": "Suggested HS code category"\n'
    '        }\n'
    '    ],\n'
    '    "translated_query": "Full client request translation in Chinese"\n'
    '}'
)

# ═══════════════════════════════════════════════════════════════════════════════
# User Message Builders
# ═══════════════════════════════════════════════════════════════════════════════


def build_extract_user_prompt(arabic_text: str) -> str:
    """Build the user prompt for entity extraction (Prompt A)."""
    return (
        f"قم بتحليل طلب الاستيراد التالي واستخراج معلومات المنتجات والوجهة:\n\n"
        f"{arabic_text}"
    )


def build_translate_user_prompt(arabic_text: str, extracted_entities: dict) -> str:
    """Build the user prompt for Chinese translation (Prompt B).

    Args:
        arabic_text: Original Arabic client request.
        extracted_entities: The JSON entities extracted in Prompt A.

    Returns:
        Formatted user prompt string.
    """
    import json
    entities_str = json.dumps(extracted_entities, ensure_ascii=False, indent=2)
    return (
        f"قم بترجمة طلب الاستيراد التالي من العربية إلى الصينية:\n\n"
        f"النص الأصلي: {arabic_text}\n\n"
        f"المعلومات المستخرجة:\n{entities_str}\n\n"
        f"قم بترجمة أسماء المنتجات والمواصفات إلى الصينية باستخدام مصطلحات الصناعة الدقيقة."
    )


def build_translate_user_prompt_en(arabic_text: str, extracted_entities: dict) -> str:
    """Build the user prompt for Chinese translation in English (Prompt B)."""
    import json
    entities_str = json.dumps(extracted_entities, ensure_ascii=False, indent=2)
    return (
        f"Translate the following import request from Arabic to Chinese:\n\n"
        f"Original text: {arabic_text}\n\n"
        f"Extracted information:\n{entities_str}\n\n"
        f"Translate product names and specifications into Chinese using precise "
        f"industrial terminology. Include Pinyin where relevant."
    )


def build_translate_user_prompt_legacy(arabic_text: str) -> str:
    """Legacy: Build combined user prompt for translate + extract in one call.

    Used by the /translate endpoint for synchronous single-call operation.
    """
    return f"قم بترجمة طلب الاستيراد التالي إلى الصينية واستخراج المعلومات:\n\n{arabic_text}"
