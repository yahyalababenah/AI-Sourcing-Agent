"""
AI-Sourcing Hub — Pricing Calculation Engine

Implements the 16 pricing rules for Chinese import quotation:
- Exchange rates (CNY→JOD/USD)
- Freight costs per port
- Customs duties
- Commission rates
- MOQ discounts
- Tax / margin calculations
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from dataclasses import dataclass, field
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
    commission: float
    subtotal: float
    discount: float
    total: float


# ═══════════════════════════════════════════════════════════
# Pricing Engine
# ═══════════════════════════════════════════════════════════

class PricingEngine:
    """Core pricing engine applying the 16 rules."""

    # ── Default rule values (overridden by DB rules) ──
    DEFAULTS = {
        # Exchange rates
        "exchange_rate_cny_jod": 0.077,  # 1 CNY ≈ 0.077 JOD
        "exchange_rate_cny_usd": 0.14,   # 1 CNY ≈ 0.14 USD
        # Freight (USD, will be converted)
        "freight_aqaba_20ft": 1200.0,
        "freight_aqaba_40ft": 2000.0,
        "freight_beirut_20ft": 1000.0,
        "freight_beirut_40ft": 1800.0,
        # Customs duty rate (Jordan)
        "customs_duty_rate_general": 0.05,  # 5% general
        "customs_duty_rate_reduced": 0.0,   # 0% for certain goods
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

    # ── Rule 1-2: Exchange Rate ──

    def _resolve_exchange_rate(self, ctx: PricingContext) -> float:
        """Resolve exchange rate from CNY to target currency.

        Rules:
            R1: CNY→JOD exchange rate
            R2: CNY→USD exchange rate (fallback for USD-based freight)
        """
        if ctx.target_currency.upper() == "JOD":
            rate = self.rules.get("exchange_rate_cny_jod", 0.077)
            ctx.exchange_rate_source = "CNY→JOD (direct)"
        elif ctx.target_currency.upper() == "USD":
            rate = self.rules.get("exchange_rate_cny_usd", 0.14)
            ctx.exchange_rate_source = "CNY→USD (direct)"
        else:
            # Fallback: use JOD rate and convert via USD
            rate = self.rules.get("exchange_rate_cny_jod", 0.077)
            ctx.exchange_rate_source = f"CNY→JOD→{ctx.target_currency} (via USD)"

        ctx.rules_applied.append(f"exchange_rate:{ctx.exchange_rate_source}={rate}")
        return rate

    # ── Rule 3-6: Freight Costs ──

    def _calculate_freight(self, ctx: PricingContext, total_quantity: int) -> float:
        """Calculate freight cost based on destination port and volume.

        Rules:
            R3: Freight to Aqaba (20ft container)
            R4: Freight to Aqaba (40ft container)
            R5: Freight to Beirut (20ft container)
            R6: Freight to Beirut (40ft container)

        Assumes ~1000 units per 20ft container for estimation.
        """
        port_lower = ctx.destination_port.lower()
        units_per_20ft = 1000  # estimate

        if "aqaba" in port_lower:
            if total_quantity >= 2000:
                freight = self.rules.get("freight_aqaba_40ft", 2000.0)
                ctx.rules_applied.append("freight:aqaba_40ft")
            else:
                freight = self.rules.get("freight_aqaba_20ft", 1200.0)
                ctx.rules_applied.append("freight:aqaba_20ft")
        elif "beirut" in port_lower:
            if total_quantity >= 2000:
                freight = self.rules.get("freight_beirut_40ft", 1800.0)
                ctx.rules_applied.append("freight:beirut_40ft")
            else:
                freight = self.rules.get("freight_beirut_20ft", 1000.0)
                ctx.rules_applied.append("freight:beirut_20ft")
        else:
            # Default to Aqaba 20ft
            freight = self.rules.get("freight_aqaba_20ft", 1200.0)
            ctx.rules_applied.append(f"freight:default_{port_lower}")

        ctx.freight_cost_total = freight
        ctx.freight_per_unit = freight / max(total_quantity, 1)
        return freight

    # ── Rule 7-8: Customs Duties ──

    def _calculate_customs_duty(
        self, ctx: PricingContext, subtotal: float
    ) -> float:
        """Calculate customs duty.

        Rules:
            R7: General customs duty rate (5% for most goods)
            R8: Reduced customs duty rate (0% for certain exemptions)
        """
        # Default to general rate
        rate = self.rules.get("customs_duty_rate_general", 0.05)
        ctx.customs_duty_rate = rate
        ctx.rules_applied.append(f"customs:general_rate={rate}")
        return subtotal * rate

    # ── Rule 9-10: Commission ──

    def _calculate_commission(
        self, ctx: PricingContext, subtotal: float
    ) -> float:
        """Calculate agent commission.

        Rules:
            R9: Standard commission (3%)
            R10: Premium commission (5% for high-value deals)
        """
        rate = self.rules.get("commission_rate_standard", 0.03)
        ctx.commission_rate = rate
        ctx.rules_applied.append(f"commission:standard={rate}")
        return subtotal * rate

    # ── Rule 11-13: MOQ Discounts ──

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
            rate = self.rules.get("moq_discount_10000_plus", 0.08)
            ctx.rules_applied.append(f"moq_discount:10000_plus={rate}")
        elif quantity >= 5000:
            rate = self.rules.get("moq_discount_5000_plus", 0.05)
            ctx.rules_applied.append(f"moq_discount:5000_plus={rate}")
        elif quantity >= 1000:
            rate = self.rules.get("moq_discount_1000_plus", 0.02)
            ctx.rules_applied.append(f"moq_discount:1000_plus={rate}")
        else:
            rate = 0.0

        ctx.moq_discount_rate = rate
        return rate

    # ── Rule 14: VAT ──

    def _calculate_vat(self, ctx: PricingContext, amount: float) -> float:
        """Calculate VAT.

        Rule:
            R14: VAT rate (16% Jordan standard)
        """
        rate = self.rules.get("vat_rate", 0.16)
        ctx.vat_rate = rate
        ctx.rules_applied.append(f"vat:rate={rate}")
        return amount * rate

    # ── Rule 15: Early Payment Discount ──

    def _early_payment_discount(self, ctx: PricingContext) -> float:
        """Early payment discount rate.

        Rule:
            R15: 2% discount for early payment
        """
        rate = self.rules.get("early_payment_discount", 0.02)
        ctx.early_payment_discount = rate
        ctx.rules_applied.append(f"early_payment_discount={rate}")
        return rate

    # ── Rule 16: Target Margin ──

    def _target_margin(self, ctx: PricingContext) -> float:
        """Target profit margin.

        Rule:
            R16: 15% target margin
        """
        rate = self.rules.get("target_margin", 0.15)
        ctx.target_margin = rate
        ctx.rules_applied.append(f"target_margin={rate}")
        return rate

    # ═══════════════════════════════════════════════════════════
    # Main Calculation
    # ═══════════════════════════════════════════════════════════

    def calculate(
        self,
        rfq_id: str,
        target_currency: str,
        destination_port: str,
        products: list[LineItemInput],
    ) -> dict:
        """Run full pricing calculation for a set of products.

        Args:
            rfq_id: RFQ UUID.
            target_currency: Target currency code (JOD, USD).
            destination_port: Destination port name.
            products: List of product line items.

        Returns:
            Dict with line_items, grand_total, exchange_rate, etc.
        """
        ctx = PricingContext(
            rfq_id=rfq_id,
            target_currency=target_currency.upper(),
            destination_port=destination_port,
        )

        # Step 1: Resolve exchange rate
        ctx.exchange_rate = self._resolve_exchange_rate(ctx)

        # Step 2: Calculate total volume for freight estimation
        total_quantity = sum(p.quantity for p in products)
        self._calculate_freight(ctx, total_quantity)

        # Step 3: Calculate each line item
        line_items: list[LineItemResult] = []
        grand_total = 0.0
        discount_total = 0.0

        for product in products:
            # Convert unit price
            unit_converted = product.unit_price_cny * ctx.exchange_rate

            # Subtotal (before adjustments)
            subtotal = unit_converted * product.quantity

            # Freight allocation (per product proportionally)
            freight_alloc = ctx.freight_per_unit * product.quantity

            # Customs duty (on converted value + freight)
            duty_base = subtotal + freight_alloc
            customs = self._calculate_customs_duty(ctx, duty_base)

            # Commission
            commission_base = subtotal + freight_alloc + customs
            commission = self._calculate_commission(ctx, commission_base)

            # MOQ discount
            moq_rate = self._calculate_moq_discount(ctx, product.quantity)
            discount = subtotal * moq_rate

            # Total for line
            line_total = subtotal + freight_alloc + customs + commission - discount

            line_items.append(LineItemResult(
                product_id=product.product_id,
                product_name=product.product_name,
                quantity=product.quantity,
                unit_price_cny=product.unit_price_cny,
                exchange_rate=ctx.exchange_rate,
                unit_price_converted=round(unit_converted, 4),
                freight_cost=round(freight_alloc, 2),
                customs_duty=round(customs, 2),
                commission=round(commission, 2),
                subtotal=round(subtotal, 2),
                discount=round(discount, 2),
                total=round(line_total, 2),
            ))

            grand_total += line_total
            discount_total += discount

        # Apply early payment discount to grand total
        early_discount_rate = self._early_payment_discount(ctx)
        early_discount = grand_total * early_discount_rate
        discount_total += early_discount

        # VAT on grand total (before early payment discount)
        vat = self._calculate_vat(ctx, grand_total)

        # Final total
        final_total = grand_total + vat - early_discount

        # Target margin check
        self._target_margin(ctx)

        return {
            "rfq_id": rfq_id,
            "target_currency": target_currency.upper(),
            "exchange_rate_used": ctx.exchange_rate,
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
