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
    hs_entry: Optional[dict] = None  # HSCodeFeeSchedule fields, pre-loaded by service.py
    has_license: bool = False  # Whether the importer has confirmed the required license/certificate


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
    insurance_cost: float
    cif_value: float
    customs_duty: float
    clearance_fee: float
    commission: float
    subtotal: float
    discount: float
    total: float
    service_flat_301: float = 0.0
    service_percent_070: float = 0.0
    penalty_018: float = 0.0
    hs_code_matched: bool = False


# ═══════════════════════════════════════════════════════════
# Pricing Engine
# ═══════════════════════════════════════════════════════════

class PricingEngine:
    """Core pricing engine applying the landed cost algorithm."""

    # ── Default rule values (overridden by DB rules) ──
    # NOTE (corrected): exchange rate and customs/VAT base logic were verified
    # against a real Jordan Customs (JCAP) tax-simulation result and fixed
    # accordingly — see calculate_landed_cost() docstring for the change log.
    DEFAULTS = {
        # Exchange rates — was stale at 0.077, updated to current market rate
        "exchange_rate_cny_jod": 0.1047,  # 1 CNY ≈ 0.1047 JOD (live refresh preferred; see /exchange-rates/refresh)
        "exchange_rate_cny_usd": 0.14,    # 1 CNY ≈ 0.14 USD
        # Sea freight per CBM (roadmap §2.4.1)
        "sea_freight_aqaba": 75.0,       # $75 / CBM to Aqaba (within researched 30-90 USD/CBM LCL range)
        "sea_freight_jeddah": 60.0,      # $60 / CBM to Jeddah
        "sea_freight_default": 80.0,     # $80 / CBM fallback
        # Insurance — CIF = Cost + Insurance + Freight; this was missing entirely before
        "insurance_rate": 0.01,          # 1% of (goods value + freight), typical marine cargo insurance
        # Customs duty rate (Jordan) — ad valorem, applied on CIF, NOT goods price alone
        "customs_duty_rate_general": 0.05,  # 5% general — ⚠️ VERIFY per actual HS-Code via JCAP; varies 0-30% by category
        "customs_duty_rate_reduced": 0.0,   # 0% for certain goods
        # Clearance fee (flat, USD) — private broker/port fee, kept separate from the government VAT base
        "clearance_fee": 150.0,          # $150 flat clearance fee
        # Commission — platform/agent fee, NOT part of the government tax (VAT) base
        "commission_rate_standard": 0.03,   # 3%
        "commission_rate_premium": 0.05,    # 5%
        # MOQ Discounts
        "moq_discount_1000_plus": 0.02,     # 2% off for ≥1000 units
        "moq_discount_5000_plus": 0.05,     # 5% off for ≥5000 units
        "moq_discount_10000_plus": 0.08,    # 8% off for ≥10000 units
        # Other
        "vat_rate": 0.16,                   # 16% GST — confirmed against real JCAP result: base = (CIF + customs duty)
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
        hs_entry: Optional[dict] = None,
        has_license: bool = False,
    ) -> dict:
        """Calculate landed cost for a single product (10-step algorithm).

        CORRECTED ALGORITHM (verified against a real Jordan Customs JCAP
        tax-simulation result — see PROJECT_STATUS_REPORT / pricing chat log):
        the previous version computed customs duty on goods price alone and
        VAT on the full post-commission total. Both diverged from the real
        JCAP result, where: customs duty is levied on CIF (goods + freight +
        insurance), and GST/VAT = (CIF + duty) × 16% — NOT on freight,
        clearance, or commission.

          1. ``price_usd = price_rmb * exchange_rate_cny_usd``
          2. ``price_local = price_usd × (USD → currency)``
          3. ``volume_cbm = estimate_volume_cbm(weight_kg)``
          4. ``freight_per_unit = (sea_freight_{port} × volume_cbm) / quantity``
          5. ``insurance_per_unit = (price_local + freight_per_unit) × insurance_rate``
          6. ``cif_per_unit = price_local + freight_per_unit + insurance_per_unit``
          7. ``customs_per_unit = cif_per_unit × (customs_rate / 100)``  ← base is CIF, not goods price alone
          8. ``clearance_per_unit = clearance_fee / quantity``  (private broker/port fee, excluded from VAT base)
          9. ``commission_per_unit = (price_local + freight + customs + clearance)
                                   × (agent_commission_pct / 100)``  (platform fee, excluded from VAT base)
          10. ``total_per_unit = price_local + freight + customs + clearance + commission``
              (VAT is computed separately by the caller on CIF+duty and added on top — see calculate())

        Args:
            price_rmb: Unit price in RMB/CNY.
            weight_kg: Per-unit weight in kilograms.
            quantity: Number of units.
            destination_port: Destination port name (e.g. "Aqaba", "Jeddah").
            currency: Target currency code (e.g. "JOD", "USD").
            agent_commission_pct: Commission percentage (default 3.0%).
            hs_entry: Optional pre-loaded HSCodeFeeSchedule fields (dict) for
                this product's HS code. When present, duty (001), the flat
                (301) and percent (070) service fees, and the conditional
                import penalty (018) are computed from it instead of the
                general customs_duty_rate_general fallback.
            has_license: Whether the importer has confirmed the required
                license/conformity certificate for hs_entry.requires_license.
                Only relevant when hs_entry is provided.

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

        # ── Step 5: Insurance (was missing entirely — CIF requires it) ──
        insurance_rate = self._get_rule_value("insurance_rate", 0.01)
        insurance_per_unit = (price_local + freight_per_unit) * insurance_rate

        # ── Step 6: CIF value (Cost + Insurance + Freight) — the official customs valuation base ──
        cif_per_unit = price_local + freight_per_unit + insurance_per_unit

        # ── Step 7: Customs duty (001) — levied on CIF, not on goods price alone ──
        # If an HS-Code fee schedule is available, it replaces the general fallback
        # rate for 001, and additionally supplies 301 (flat service fee), 070
        # (percent service fee), and 018 (conditional import penalty). All four
        # are real JCAP tax-simulation line items; only 001 feeds into the VAT
        # (020) base — see calculate() for vat_base_total, which stays CIF+001 only.
        service_flat_per_unit = 0.0
        service_percent_per_unit = 0.0
        penalty_per_unit = 0.0
        hs_code_matched = False
        hs_rules_applied: list[str] = []

        if hs_entry is not None:
            hs_code_matched = True
            customs_rate = hs_entry["duty_rate_001"] / 100.0
            customs_per_unit = cif_per_unit * customs_rate
            service_percent_per_unit = cif_per_unit * (hs_entry["service_percent_070"] / 100.0)
            service_flat_per_unit = hs_entry["service_flat_fee_301"] / max(quantity, 1)
            if hs_entry.get("requires_license") and not has_license:
                penalty_per_unit = cif_per_unit * (hs_entry["penalty_rate_018"] / 100.0)
                hs_rules_applied.append(
                    "penalty_018:conditional=license/conformity certificate not confirmed"
                )
            hs_rules_applied.append(f"customs_rate={customs_rate}(base=CIF,hs_code_matched)")
            hs_rules_applied.append(f"service_percent_070={hs_entry['service_percent_070']}%")
            hs_rules_applied.append(f"service_flat_301={hs_entry['service_flat_fee_301']}")
        else:
            customs_rate = self._get_rule_value("customs_duty_rate_general", 0.05)
            customs_per_unit = cif_per_unit * customs_rate
            hs_rules_applied.append(f"customs_rate={customs_rate}(base=CIF)")
            hs_rules_applied.append("hs_code_not_found:fallback_to_general_rate")

        # ── Step 8: Clearance fee (private broker/port fee — excluded from VAT base) ──
        clearance_fee_total = self._get_rule_value("clearance_fee", 150.0)
        clearance_per_unit = clearance_fee_total / max(quantity, 1)

        # ── Step 9: Commission (platform/agent fee — excluded from VAT base) ──
        # 301/070/018 are real importer costs like clearance, so they're added to
        # the commercial total the same way — but excluded from the VAT base.
        total_before_commission = (
            price_local
            + freight_per_unit
            + customs_per_unit
            + clearance_per_unit
            + service_percent_per_unit
            + service_flat_per_unit
            + penalty_per_unit
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
            f"insurance_rate={insurance_rate}",
            f"clearance_fee={clearance_fee_total}",
            f"commission_pct={agent_commission_pct}%",
            *hs_rules_applied,
        ]

        return {
            "price_rmb": price_rmb,
            "price_usd": round(price_usd, 4),
            "price_local": round(price_local, 4),
            "volume_cbm": round(volume_cbm, 4),
            "sea_freight_cbm": sea_freight_cbm,
            "freight_per_unit": round(freight_per_unit, 2),
            "insurance_per_unit": round(insurance_per_unit, 2),
            "cif_per_unit": round(cif_per_unit, 2),
            "customs_per_unit": round(customs_per_unit, 2),
            "clearance_per_unit": round(clearance_per_unit, 2),
            "service_flat_per_unit": round(service_flat_per_unit, 2),
            "service_percent_per_unit": round(service_percent_per_unit, 2),
            "penalty_per_unit": round(penalty_per_unit, 2),
            "hs_code_matched": hs_code_matched,
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
        total_insurance = 0.0
        total_customs = 0.0
        total_clearance = 0.0
        total_commission = 0.0
        vat_base_total = 0.0  # sum of (CIF + duty) per line — the correct GST base per JCAP

        for product in products:
            # Run landed cost for this product
            lc = self.calculate_landed_cost(
                price_rmb=product.unit_price_cny,
                weight_kg=product.weight_kg,
                quantity=product.quantity,
                destination_port=destination_port,
                currency=target_currency,
                agent_commission_pct=agent_commission_pct,
                hs_entry=product.hs_entry,
                has_license=product.has_license,
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
                insurance_cost=lc["insurance_per_unit"] * product.quantity,
                cif_value=lc["cif_per_unit"] * product.quantity,
                customs_duty=lc["customs_per_unit"] * product.quantity,
                clearance_fee=lc["clearance_per_unit"] * product.quantity,
                commission=lc["commission_per_unit"] * product.quantity,
                subtotal=lc["price_local"] * product.quantity,
                discount=round(discount, 2),
                total=round(line_total, 2),
                service_flat_301=round(lc["service_flat_per_unit"] * product.quantity, 2),
                service_percent_070=round(lc["service_percent_per_unit"] * product.quantity, 2),
                penalty_018=round(lc["penalty_per_unit"] * product.quantity, 2),
                hs_code_matched=lc["hs_code_matched"],
            )
            line_items.append(line_item)

            grand_total += line_total
            discount_total += discount
            total_freight += lc["freight_per_unit"] * product.quantity
            total_insurance += lc["insurance_per_unit"] * product.quantity
            total_customs += lc["customs_per_unit"] * product.quantity
            total_clearance += lc["clearance_per_unit"] * product.quantity
            total_commission += lc["commission_per_unit"] * product.quantity
            # CORRECTED: VAT base is (CIF + duty) per JCAP, not the full commercial total
            vat_base_total += (lc["cif_per_unit"] + lc["customs_per_unit"]) * product.quantity
            ctx.rules_applied.extend(lc["rules_applied"])

        # Early payment discount — applied against the commercial subtotal (business rule, not government tax)
        early_discount_rate = self._early_payment_discount(ctx)
        early_discount = grand_total * early_discount_rate
        discount_total += early_discount

        # VAT — CORRECTED: computed on (CIF + customs duty) only, per verified JCAP
        # result, NOT on the full commercial total (which also includes freight,
        # clearance fee, and platform commission — none of which belong in the
        # government tax base). VAT is still added on top of the commercial total,
        # since it is a real cost the importer must pay.
        vat = self._calculate_vat(ctx, vat_base_total)

        # Final total = commercial total (goods+freight+insurance+duty+clearance+commission)
        # + VAT (on CIF+duty only) - early payment discount
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
                    "insurance_cost": li.insurance_cost,
                    "cif_value": li.cif_value,
                    "customs_duty": li.customs_duty,
                    "clearance_fee": li.clearance_fee,
                    "commission": li.commission,
                    "subtotal": li.subtotal,
                    "discount": li.discount,
                    "total": li.total,
                    "service_flat_301": li.service_flat_301,
                    "service_percent_070": li.service_percent_070,
                    "penalty_018": li.penalty_018,
                    "hs_code_matched": li.hs_code_matched,
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
