"""
AI-Sourcing Hub — Pricing Calculation Engine

Implements the landed cost calculation for Chinese import quotation:
  1. Convert RMB → USD
  2. Convert USD → local currency
  3. Estimate volume (CBM) from weight
  4. Calculate freight per unit (sea_freight_cbm × volume_cbm / quantity)
  5. Calculate customs duty (% of price_local)
  6. Add clearance fee (flat, divided across units)
  7. Calculate commission on (price + freight + customs + clearance)
  8. Sum total per unit
  9. Return full breakdown dict

Exchange rates follow: 1 source_currency = rate * target_currency
  e.g. exchange_rate_cny_usd = 0.14 means 1 CNY = 0.14 USD
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════

@dataclass
class PricingContext:
    """Context for a single pricing calculation."""

    rfq_id: str
    target_currency: str
    destination_port: str
    exchange_rate: float = 0.0  # CNY → target
    exchange_rate_source: str = "default"

    # Freight
    freight_cost_total: float = 0.0
    freight_per_unit: float = 0.0

    # Customs
    customs_duty_rate: float = 0.0

    # Commission
    commission_rate: float = 0.0

    # Discounts
    moq_discount_rate: float = 0.0
    early_payment_discount: float = 0.0

    # Tax
    vat_rate: float = 0.0

    # Margin
    target_margin: float = 0.0

    # Tracking
    rules_applied: list[str] = field(default_factory=list)


@dataclass
class LineItemInput:
    """Input for a single line item calculation."""

    product_id: str
    product_name: str
    quantity: int
    unit_price_cny: float
    weight_kg: float = 0.0  # Per-unit weight for CBM estimation


@dataclass
class LineItemResult:
    """Result for a single line item."""

    product_id: str
    product_name: str
    quantity: int
    unit_price_cny: float
    exchange_rate: float
    unit_price_converted: float
    freight_cost: float
    customs_duty: float
    clearance_fee: float
    commission: float
    subtotal: float
    discount: float
    total: float


# ═══════════════════════════════════════════════════════════
# Pricing Engine
# ═══════════════════════════════════════════════════════════

class PricingEngine:
    """Core pricing engine applying the landed cost algorithm."""

    # ── Default rule values (overridden by DB rules) ──
    DEFAULTS = {
        # Exchange rates
        "exchange_rate_cny_jod": 0.077,  # 1 CNY ≈ 0.077 JOD
        "exchange_rate_cny_usd": 0.14,   # 1 CNY ≈ 0.14 USD
        # Sea freight per CBM (roadmap §2.4.1)
        "sea_freight_aqaba": 75.0,       # $75 / CBM to Aqaba
        "sea_freight_jeddah": 60.0,      # $60 / CBM to Jeddah
        "sea_freight_default": 80.0,     # $80 / CBM fallback
        # Customs duty rate (Jordan)
        "customs_duty_rate_general": 0.05,  # 5% general
        "customs_duty_rate_reduced": 0.0,   # 0% for certain goods
        # Clearance fee (flat, USD)
        "clearance_fee": 150.0,          # $150 flat clearance fee
        # Commission
        "commission_rate_standard": 0.03,   # 3%
        "commission_rate_premium": 0.05,    # 5%
        # MOQ Discounts
        "moq_discount_1000_plus": 0.02,     # 2% off for ≥1000 units
        "moq_discount_5000_plus": 0.05,     # 5% off for ≥5000 units
        "moq_discount_10000_plus": 0.08,    # 8% off for ≥10000 units
        # Other
        "vat_rate": 0.16,                   # 16% VAT (Jordan)
        "target_margin": 0.15,              # 15% target margin
        "early_payment_discount": 0.02,     # 2% for early payment
    }

    def __init__(self, rules_override: Optional[dict[str, float]] = None):
        """Initialize engine with optional rule overrides.

        Args:
            rules_override: Dict of rule names → values to override defaults.
        """
        self.rules = {**self.DEFAULTS, **(rules_override or {})}
        logger.info(
            "Pricing engine initialized",
            extra={"rule_count": len(self.rules)},
        )

    # ═══════════════════════════════════════════════════════════
    # Helpers
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def estimate_volume_cbm(weight_kg: float) -> float:
        """Estimate volume in cubic metres from weight.

        Standard sea freight density: ~500 kg per CBM.
        If weight is unknown (zero), returns a minimum estimate of 0.1 CBM.

        Args:
            weight_kg: Weight of goods in kilograms.

        Returns:
            Estimated volume in cubic metres.
        """
        if weight_kg <= 0:
            return 0.1
        return weight_kg / 500.0

    def _get_rule_value(self, name: str, default: float = 0.0) -> float:
        """Get a rule value from the merged rules dict.

        Args:
            name: Rule name.
            default: Fallback value if rule not found.

        Returns:
            Rule value as float.
        """
        return float(self.rules.get(name, default))

    # ═══════════════════════════════════════════════════════════
    # Landed Cost Calculation (per-product)
    # ═══════════════════════════════════════════════════════════

    def calculate_landed_cost(
        self,
        price_rmb: float,
        weight_kg: float,
        quantity: int,
        destination_port: str,
        currency: str,
        agent_commission_pct: float = 3.0,
    ) -> dict:
        """Calculate landed cost for a single product (9-step algorithm).

        Implements the roadmap §2.4.1 algorithm:

          1. ``price_usd = price_rmb * exchange_rate_cny_usd``
          2. ``price_local = price_usd × (USD → currency)``
          3. ``volume_cbm = estimate_volume_cbm(weight_kg)``
          4. ``freight_per_unit = (sea_freight_{port} × volume_cbm) / quantity``
          5. ``customs_per_unit = price_local × (customs_rate / 100)``
          6. ``clearance_per_unit = clearance_fee / quantity``
          7. ``commission_per_unit = (price_local + freight + customs + clearance)
                                   × (agent_commission_pct / 100)``
          8. ``total_per_unit = price_local + freight + customs + clearance + commission``
          9. Return full breakdown dict

        Args:
            price_rmb: Unit price in RMB/CNY.
            weight_kg: Per-unit weight in kilograms.
            quantity: Number of units.
            destination_port: Destination port name (e.g. "Aqaba", "Jeddah").
            currency: Target currency code (e.g. "JOD", "USD").
            agent_commission_pct: Commission percentage (default 3.0%).

        Returns:
            Dict with all intermediate and final values.

        Raises:
            ValueError: If quantity <= 0 or price_rmb < 0.
        """
        if quantity <= 0:
            raise ValueError(f"Quantity must be > 0, got {quantity}")
        if price_rmb < 0:
            raise ValueError(f"Price must be >= 0, got {price_rmb}")

        currency_upper = currency.upper()

        # ── Step 1: Convert RMB → USD ──
        cny_to_usd = self._get_rule_value("exchange_rate_cny_usd", 0.14)
        price_usd = price_rmb * cny_to_usd

        # ── Step 2: Convert USD → local currency ──
        if currency_upper == "USD":
            price_local = price_usd
            usd_rate = 1.0
        elif currency_upper == "JOD":
            # Derive USD→JOD from CNY→JOD and CNY→USD
            cny_to_jod = self._get_rule_value("exchange_rate_cny_jod", 0.077)
            usd_to_jod = cny_to_jod / cny_to_usd if cny_to_usd else 0.55
            price_local = price_usd * usd_to_jod
            usd_rate = usd_to_jod
        else:
            # Unknown currency — fallback to JOD
            cny_to_jod = self._get_rule_value("exchange_rate_cny_jod", 0.077)
            usd_to_jod = cny_to_jod / cny_to_usd if cny_to_usd else 0.55
            price_local = price_usd * usd_to_jod
            usd_rate = usd_to_jod
            logger.warning(
                "Unknown target currency, falling back to JOD",
                extra={"currency": currency_upper},
            )

        # ── Step 3: Estimate volume ──
        volume_cbm = self.estimate_volume_cbm(weight_kg)

        # ── Step 4: Sea freight ──
        port_lower = destination_port.lower().replace(" ", "_")
        port_rule_name = f"sea_freight_{port_lower}"
        sea_freight_cbm = self._get_rule_value(port_rule_name)
        if sea_freight_cbm == 0.0:
            sea_freight_cbm = self._get_rule_value("sea_freight_default", 80.0)

        total_freight = sea_freight_cbm * volume_cbm
        freight_per_unit = total_freight / max(quantity, 1)

        # ── Step 5: Customs duty ──
        customs_rate = self._get_rule_value("customs_duty_rate_general", 0.05)
        customs_per_unit = price_local * customs_rate

        # ── Step 6: Clearance fee ──
        clearance_fee_total = self._get_rule_value("clearance_fee", 150.0)
        clearance_per_unit = clearance_fee_total / max(quantity, 1)

        # ── Step 7: Commission ──
        total_before_commission = (
            price_local + freight_per_unit + customs_per_unit + clearance_per_unit
        )
        commission_pct = agent_commission_pct / 100.0
        commission_per_unit = total_before_commission * commission_pct

        # ── Step 8: Total per unit ──
        total_per_unit = total_before_commission + commission_per_unit
        grand_total = total_per_unit * quantity

        # ── Step 9: Build breakdown ──
        applied_rules = [
            f"exchange_rate:cny_usd={cny_to_usd}",
            f"exchange_rate:usd_{currency_upper}={usd_rate}",
            f"sea_freight:{port_rule_name}={sea_freight_cbm}",
            f"volume_cbm={volume_cbm:.4f}",
            f"customs_rate={customs_rate}",
            f"clearance_fee={clearance_fee_total}",
            f"commission_pct={agent_commission_pct}%",
        ]

        return {
            "price_rmb": price_rmb,
            "price_usd": round(price_usd, 4),
            "price_local": round(price_local, 4),
            "volume_cbm": round(volume_cbm, 4),
            "sea_freight_cbm": sea_freight_cbm,
            "freight_per_unit": round(freight_per_unit, 2),
            "customs_per_unit": round(customs_per_unit, 2),
            "clearance_per_unit": round(clearance_per_unit, 2),
            "commission_per_unit": round(commission_per_unit, 2),
            "total_per_unit": round(total_per_unit, 2),
            "grand_total": round(grand_total, 2),
            "quantity": quantity,
            "destination_port": destination_port,
            "currency": currency_upper,
            "exchange_rate_used": usd_rate if currency_upper != "USD" else 1.0,
            "rules_applied": applied_rules,
        }

    # ═══════════════════════════════════════════════════════════
    # Main Multi-Product Calculation
    # ═══════════════════════════════════════════════════════════

    def calculate(
        self,
        rfq_id: str,
        target_currency: str,
        destination_port: str,
        products: list[LineItemInput],
        agent_commission_pct: float = 3.0,
    ) -> dict:
        """Run full pricing calculation for a set of products.

        Uses the landed cost algorithm (``calculate_landed_cost``) per product
        and aggregates results.

        Args:
            rfq_id: RFQ UUID.
            target_currency: Target currency code (JOD, USD).
            destination_port: Destination port name.
            products: List of product line items.
            agent_commission_pct: Commission percentage (default 3.0%).

        Returns:
            Dict with line_items, grand_total, exchange_rate, rules_applied, etc.
        """
        ctx = PricingContext(
            rfq_id=rfq_id,
            target_currency=target_currency.upper(),
            destination_port=destination_port,
        )

        line_items: list[LineItemResult] = []
        grand_total = 0.0
        discount_total = 0.0
        total_freight = 0.0
        total_customs = 0.0
        total_clearance = 0.0
        total_commission = 0.0

        for product in products:
            # Run landed cost for this product
            lc = self.calculate_landed_cost(
                price_rmb=product.unit_price_cny,
                weight_kg=product.weight_kg,
                quantity=product.quantity,
                destination_port=destination_port,
                currency=target_currency,
                agent_commission_pct=agent_commission_pct,
            )

            # MOQ discount
            moq_rate = self._calculate_moq_discount(ctx, product.quantity)
            discount = lc["total_per_unit"] * product.quantity * moq_rate

            line_total = lc["grand_total"] - discount

            line_item = LineItemResult(
                product_id=product.product_id,
                product_name=product.product_name,
                quantity=product.quantity,
                unit_price_cny=product.unit_price_cny,
                exchange_rate=lc["exchange_rate_used"],
                unit_price_converted=lc["price_local"],
                freight_cost=lc["freight_per_unit"] * product.quantity,
                customs_duty=lc["customs_per_unit"] * product.quantity,
                clearance_fee=lc["clearance_per_unit"] * product.quantity,
                commission=lc["commission_per_unit"] * product.quantity,
                subtotal=lc["price_local"] * product.quantity,
                discount=round(discount, 2),
                total=round(line_total, 2),
            )
            line_items.append(line_item)

            grand_total += line_total
            discount_total += discount
            total_freight += lc["freight_per_unit"] * product.quantity
            total_customs += lc["customs_per_unit"] * product.quantity
            total_clearance += lc["clearance_per_unit"] * product.quantity
            total_commission += lc["commission_per_unit"] * product.quantity
            ctx.rules_applied.extend(lc["rules_applied"])

        # Early payment discount
        early_discount_rate = self._early_payment_discount(ctx)
        early_discount = grand_total * early_discount_rate
        discount_total += early_discount

        # VAT on grand total
        vat = self._calculate_vat(ctx, grand_total)

        # Final total
        final_total = grand_total + vat - early_discount

        # Target margin check
        self._target_margin(ctx)

        return {
            "rfq_id": rfq_id,
            "target_currency": target_currency.upper(),
            "exchange_rate_used": line_items[0].exchange_rate if line_items else 0.0,
            "line_items": [
                {
                    "product_id": li.product_id,
                    "product_name": li.product_name,
                    "quantity": li.quantity,
                    "unit_price_cny": li.unit_price_cny,
                    "exchange_rate": li.exchange_rate,
                    "unit_price_converted": li.unit_price_converted,
                    "freight_cost": li.freight_cost,
                    "customs_duty": li.customs_duty,
                    "clearance_fee": li.clearance_fee,
                    "commission": li.commission,
                    "subtotal": li.subtotal,
                    "discount": li.discount,
                    "total": li.total,
                }
                for li in line_items
            ],
            "subtotal_before_vat": round(grand_total, 2),
            "vat": round(vat, 2),
            "early_payment_discount": round(early_discount, 2),
            "grand_total": round(final_total, 2),
            "discount_total": round(discount_total, 2),
            "rules_applied": list(set(ctx.rules_applied)),
        }

    # ═══════════════════════════════════════════════════════════
    # MOQ Discount  (Rules 11-13)
    # ═══════════════════════════════════════════════════════════

    def _calculate_moq_discount(
        self, ctx: PricingContext, quantity: int
    ) -> float:
        """Calculate MOQ-based discount rate.

        Rules:
            R11: 2% discount for ≥1,000 units
            R12: 5% discount for ≥5,000 units
            R13: 8% discount for ≥10,000 units
        """
        if quantity >= 10000:
            rate = self._get_rule_value("moq_discount_10000_plus", 0.08)
            ctx.rules_applied.append(f"moq_discount:10000_plus={rate}")
        elif quantity >= 5000:
            rate = self._get_rule_value("moq_discount_5000_plus", 0.05)
            ctx.rules_applied.append(f"moq_discount:5000_plus={rate}")
        elif quantity >= 1000:
            rate = self._get_rule_value("moq_discount_1000_plus", 0.02)
            ctx.rules_applied.append(f"moq_discount:1000_plus={rate}")
        else:
            rate = 0.0

        ctx.moq_discount_rate = rate
        return rate

    # ═══════════════════════════════════════════════════════════
    # VAT  (Rule 14)
    # ═══════════════════════════════════════════════════════════

    def _calculate_vat(self, ctx: PricingContext, amount: float) -> float:
        """Calculate VAT.

        Rule:
            R14: VAT rate (16% Jordan standard)
        """
        rate = self._get_rule_value("vat_rate", 0.16)
        ctx.vat_rate = rate
        ctx.rules_applied.append(f"vat:rate={rate}")
        return amount * rate

    # ═══════════════════════════════════════════════════════════
    # Early Payment Discount  (Rule 15)
    # ═══════════════════════════════════════════════════════════

    def _early_payment_discount(self, ctx: PricingContext) -> float:
        """Early payment discount rate.

        Rule:
            R15: 2% discount for early payment
        """
        rate = self._get_rule_value("early_payment_discount", 0.02)
        ctx.early_payment_discount = rate
        ctx.rules_applied.append(f"early_payment_discount={rate}")
        return rate

    # ═══════════════════════════════════════════════════════════
    # Target Margin  (Rule 16)
    # ═══════════════════════════════════════════════════════════

    def _target_margin(self, ctx: PricingContext) -> float:
        """Target profit margin.

        Rule:
            R16: 15% target margin
        """
        rate = self._get_rule_value("target_margin", 0.15)
        ctx.target_margin = rate
        ctx.rules_applied.append(f"target_margin={rate}")
        return rate
