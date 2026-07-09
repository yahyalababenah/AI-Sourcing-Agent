"""
AI-Sourcing Hub — Pricing Calculation Engine (3-Phase JCAP Pipeline)

Implements the ASYCUDA/JCAP-compliant 3-phase landed cost pipeline:

  Phase 1 — Port Arrival Cost (CIF)
    price_jod = (price_rmb × CNY_USD) × USD_JOD
    freight_jod = (freight_rate × volume_cbm) × USD_JOD
    insurance_jod = (price_jod + freight_jod) × insurance_rate
    cif_jod = price_jod + freight_jod + insurance_jod

  Phase 2 — JCAP Customs & Tax
    duty_001 = cif_jod × hs_code.duty_rate_001
    fee_070 = cif_jod × hs_code.service_percent_070
    penalty_018 = (requires_license AND NOT has_license) ? cif_jod × penalty_rate_018 : 0
    fee_301 = hs_code.service_flat_fee_301  (flat JOD, shipment-level)
    vat_base = cif_jod + duty_001 + fee_070 + penalty_018 + fee_301
    vat_020 = vat_base × hs_code.vat_rate_020
    landed_cost_jod = cif_jod + duty_001 + fee_070 + penalty_018 + fee_301 + vat_020

  Phase 3 — Commercial Pricing
    local_costs = clearance_fee_jod + inland_transport_jod
    total_base = landed_cost_jod + local_costs
    moq_discount = price_jod × moq_discount_rate
    discounted = total_base - moq_discount
    commission = discounted × commission_rate
    final_total = discounted + commission
    unit_price = final_total / quantity
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from app.modules.pricing.formula import FormulaError, evaluate_formula
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
class CustomRule:
    """An admin-created pricing rule whose name is not one of PricingEngine.DEFAULTS.

    Canonical rules (matched by exact name — e.g. "clearance_fee",
    "commission_rate_standard") are folded into the plain rules_override dict
    and never reach this path. Only rules with arbitrary names go through
    _apply_custom_rules(), where rule_type actually matters.
    """

    name: str
    rule_type: str  # percentage | fixed | formula
    value: float = 0.0
    formula: Optional[str] = None
    category: str = "other"
    priority: int = 0


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
    volume_cbm: Optional[float] = None  # Explicit CBM from packing list (Bug 5 fix)


@dataclass
class LineItemResult:
    """Result for a single line item (Phase 1 & 2 data + Phase 3 allocation)."""

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
    vat_cost: float = 0.0  # VAT portion for this line item
    vat_base: float = 0.0  # VAT base for this line item
    landed_cost: float = 0.0  # Phase 2 total (CIF + duty + fees + vat)


# ═══════════════════════════════════════════════════════════
# Pricing Engine
# ═══════════════════════════════════════════════════════════

class PricingEngine:
    """Core pricing engine implementing the 3-phase JCAP/ASYCUDA landed cost algorithm."""

    # ── Default rule values (overridden by DB rules) ──
    DEFAULTS = {
        # Exchange rates
        "exchange_rate_cny_jod": 0.1047,  # 1 CNY ≈ 0.1047 JOD (live refresh preferred)
        "exchange_rate_cny_usd": 0.14,    # 1 CNY ≈ 0.14 USD
        # Sea freight per CBM
        "sea_freight_aqaba": 75.0,       # $75 / CBM to Aqaba
        "sea_freight_jeddah": 60.0,      # $60 / CBM to Jeddah
        "sea_freight_default": 80.0,     # $80 / CBM fallback
        # Insurance
        "insurance_rate": 0.01,          # 1% of (goods value + freight)
        # Customs duty rate (Jordan) — fallback when no HS code
        "customs_duty_rate_general": 0.05,  # 5% general
        "customs_duty_rate_reduced": 0.0,   # 0% for certain goods
        # Clearance fee (flat JOD) — Bug 4 fix: treated as JOD, not USD
        "clearance_fee": 150.0,          # 150 JOD flat clearance fee
        # Commission
        "commission_rate_standard": 0.03,   # 3%
        "commission_rate_premium": 0.05,    # 5%
        # MOQ Discounts
        "moq_discount_1000_plus": 0.02,     # 2% off for ≥1000 units
        "moq_discount_5000_plus": 0.05,     # 5% off for ≥5000 units
        "moq_discount_10000_plus": 0.08,    # 8% off for ≥10000 units
        # Other
        "vat_rate": 0.16,                   # 16% GST — default when no hs_entry.vat_rate_020
        "target_margin": 0.15,              # 15% target margin
        "early_payment_discount": 0.02,     # 2% for early payment
    }

    def __init__(
        self,
        rules_override: Optional[dict[str, float]] = None,
        custom_rules: Optional[list[CustomRule]] = None,
    ):
        """Initialize engine with optional rule overrides.

        Args:
            rules_override: Dict of rule names → values to override defaults.
            custom_rules: Admin-created rules whose name is not a canonical
                DEFAULTS key — applied via _apply_custom_rules() in calculate().
        """
        self.rules = {**self.DEFAULTS, **(rules_override or {})}
        self.custom_rules = sorted(
            [r for r in (custom_rules or []) if r.name not in self.DEFAULTS],
            key=lambda r: (r.priority, r.name),
        )
        logger.info(
            "Pricing engine initialized",
            extra={"rule_count": len(self.rules), "custom_rule_count": len(self.custom_rules)},
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
        """Get a rule value from the merged rules dict."""
        return float(self.rules.get(name, default))

    @staticmethod
    def _compute_effective_volume_cbm(
        weight_kg: float,
        quantity: int,
        volume_cbm: Optional[float] = None,
    ) -> float:
        """Compute effective CBM volume (Bug 5 fix).

        If explicit volume_cbm is provided, use max(explicit, weight/500).
        Otherwise, estimate from weight.

        Args:
            weight_kg: Per-unit weight in kg.
            quantity: Number of units.
            volume_cbm: Optional explicit CBM for the shipment.

        Returns:
            Effective CBM volume for the shipment.
        """
        total_weight_kg = weight_kg * quantity
        weight_based_cbm = PricingEngine.estimate_volume_cbm(total_weight_kg)
        if volume_cbm is not None and volume_cbm > 0:
            return max(volume_cbm, weight_based_cbm)
        return weight_based_cbm

    # ═══════════════════════════════════════════════════════════
    # Phase 1 & 2: Landed Cost Calculation (per-product)
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
        volume_cbm: Optional[float] = None,
    ) -> dict:
        """Calculate Phase 1 (Port Arrival / CIF) and Phase 2 (JCAP Customs & Tax).

        3-Phase Pipeline — Phases 1 & 2 (per line item):

          Phase 1 — Port Arrival Cost (CIF):
            1. Convert RMB → USD → local currency
            2. Compute effective CBM from weight or explicit volume_cbm (Bug 5 fix)
            3. Freight = sea_freight_rate × volume_cbm / quantity
            4. Insurance = (FOB_price + Freight) × insurance_rate  (Bug 3 fix)
            5. CIF = FOB + Freight + Insurance

          Phase 2 — JCAP Customs & Tax:
            6. Duty (001) = CIF × duty_rate_001
            7. Service fee (070) = CIF × service_percent_070
            8. Penalty (018) = (requires_license AND NOT has_license) ? CIF × penalty_rate_018 : 0
            9. Flat fee (301) = hs_entry.service_flat_fee_301 (JOD flat, shipment-level)
            10. VAT base = CIF + Duty(001) + Fee(070) + Penalty(018) + Fee(301)  (Bug 1 fix)
            11. VAT (020) = VAT base × vat_rate_020
            12. Landed cost = CIF + Duty + 070 + 018 + 301 + VAT

          NOTE: Commission, MOQ discount, and local costs are Phase 3 (handled by calculate()).

        Args:
            price_rmb: Unit price in RMB/CNY.
            weight_kg: Per-unit weight in kilograms.
            quantity: Number of units.
            destination_port: Destination port name (e.g. "Aqaba", "Jeddah").
            currency: Target currency code (e.g. "JOD", "USD").
            agent_commission_pct: Commission percentage (ignored in Phases 1&2 — used in Phase 3).
            hs_entry: Optional pre-loaded HSCodeFeeSchedule dict for this product's HS code.
            has_license: Whether the importer has confirmed the required license.
            volume_cbm: Optional explicit CBM volume (Bug 5 fix).

        Returns:
            Dict with Phase 1 & 2 intermediate and final values.

        Raises:
            ValueError: If quantity <= 0 or price_rmb < 0.
        """
        if quantity <= 0:
            raise ValueError(f"Quantity must be > 0, got {quantity}")
        if price_rmb < 0:
            raise ValueError(f"Price must be >= 0, got {price_rmb}")

        currency_upper = currency.upper()

        # ════════════════════════════════════════════
        # Phase 1: Port Arrival Cost (CIF)
        # ════════════════════════════════════════════

        # ── Step 1: Convert RMB → USD → local currency ──
        cny_to_usd = self._get_rule_value("exchange_rate_cny_usd", 0.14)
        price_usd = price_rmb * cny_to_usd

        if currency_upper == "USD":
            price_local = price_usd
            usd_rate = 1.0
            cny_to_target = cny_to_usd
        elif currency_upper == "JOD":
            cny_to_jod = self._get_rule_value("exchange_rate_cny_jod", 0.077)
            usd_to_jod = cny_to_jod / cny_to_usd if cny_to_usd else 0.55
            price_local = price_usd * usd_to_jod
            usd_rate = usd_to_jod
            cny_to_target = cny_to_jod
        else:
            # Unknown currency — fallback to JOD
            cny_to_jod = self._get_rule_value("exchange_rate_cny_jod", 0.077)
            usd_to_jod = cny_to_jod / cny_to_usd if cny_to_usd else 0.55
            price_local = price_usd * usd_to_jod
            usd_rate = usd_to_jod
            cny_to_target = cny_to_jod
            logger.warning(
                "Unknown target currency, falling back to JOD",
                extra={"currency": currency_upper},
            )

        # ── Step 2: Compute effective CBM volume (Bug 5 fix) ──
        effective_volume_cbm = self._compute_effective_volume_cbm(weight_kg, quantity, volume_cbm)

        # ── Step 3: Sea freight ──
        port_lower = destination_port.lower().replace(" ", "_")
        port_rule_name = f"sea_freight_{port_lower}"
        sea_freight_cbm = self._get_rule_value(port_rule_name)
        if sea_freight_cbm == 0.0:
            sea_freight_cbm = self._get_rule_value("sea_freight_default", 80.0)

        total_freight = sea_freight_cbm * effective_volume_cbm
        freight_per_unit = total_freight / max(quantity, 1)

        # ── Step 4: Insurance (Bug 3: (FOB + Freight) × insurance_rate) ──
        insurance_rate = self._get_rule_value("insurance_rate", 0.01)
        insurance_per_unit = (price_local + freight_per_unit) * insurance_rate

        # ── Step 5: CIF (Cost + Insurance + Freight) ──
        cif_per_unit = price_local + freight_per_unit + insurance_per_unit

        # ════════════════════════════════════════════
        # Phase 2: JCAP Customs & Tax
        # ════════════════════════════════════════════

        service_flat_301_line = 0.0  # shipment-level fee — charged once, see calculate()
        service_percent_per_unit = 0.0
        penalty_per_unit = 0.0
        hs_code_matched = False
        hs_rules_applied: list[str] = []
        vat_rate_020: Optional[float] = None

        # ── Step 6-9: Duty, fees, penalty from HS entry or fallback ──
        if hs_entry is not None:
            hs_code_matched = True
            # duty_rate_001 and service_percent_070 are stored as percentage (e.g. 10 = 10%)
            customs_rate = hs_entry["duty_rate_001"] / 100.0
            customs_per_unit = cif_per_unit * customs_rate
            service_percent_per_unit = cif_per_unit * (hs_entry["service_percent_070"] / 100.0)
            service_flat_301_line = hs_entry["service_flat_fee_301"]  # JOD flat (Bug 4)
            vat_rate_020 = hs_entry.get("vat_rate_020")
            if hs_entry.get("requires_license") and not has_license:
                penalty_per_unit = cif_per_unit * (hs_entry["penalty_rate_018"] / 100.0)
                hs_rules_applied.append(
                    "penalty_018:conditional=license/conformity certificate not confirmed"
                )
            hs_rules_applied.append(f"customs_rate={customs_rate}(base=CIF,hs_code_matched)")
            hs_rules_applied.append(f"service_percent_070={hs_entry['service_percent_070']}%")
            hs_rules_applied.append(f"service_flat_301={hs_entry['service_flat_fee_301']}(per_shipment,JOD)")
        else:
            # Fallback: use general duty rate, no HS-specific fees
            customs_rate = self._get_rule_value("customs_duty_rate_general", 0.05)
            customs_per_unit = cif_per_unit * customs_rate
            hs_rules_applied.append(f"customs_rate={customs_rate}(base=CIF)")
            hs_rules_applied.append("hs_code_not_found:fallback_to_general_rate")

        # ── Step 10-11: VAT base and VAT (Bug 1 fix) ──
        # VAT Base = CIF + Duty(001) + Service Fee(070) + Penalty(018) + Flat Fee(301)
        # 301 is shipment-level, so VAT on 301 is added at aggregate level in calculate()
        vat_base_per_unit = cif_per_unit + customs_per_unit + service_percent_per_unit + penalty_per_unit

        # Determine VAT rate: per-HS override or global default
        if vat_rate_020 is not None:
            vat_rate_decimal = vat_rate_020 / 100.0
            hs_rules_applied.append(f"vat:rate={vat_rate_decimal}(hs_020_override)")
        else:
            vat_rate_decimal = self._get_rule_value("vat_rate", 0.16)
            hs_rules_applied.append(f"vat:rate={vat_rate_decimal}")

        # Per-unit VAT (301 is added at shipment level)
        vat_per_unit = vat_base_per_unit * vat_rate_decimal

        # ── Step 12: Landed cost (Phase 2 total, before Phase 3 commercial adjustments) ──
        # Note: 301 is shipment-level, added in calculate(), not per-unit
        landed_cost_per_unit = cif_per_unit + customs_per_unit + service_percent_per_unit + penalty_per_unit + vat_per_unit

        # Build applied rules
        applied_rules = [
            f"exchange_rate:cny_usd={cny_to_usd}",
            f"exchange_rate:usd_{currency_upper}={usd_rate}",
            f"sea_freight:{port_rule_name}={sea_freight_cbm}",
            f"volume_cbm={effective_volume_cbm:.4f}",
            f"insurance_rate={insurance_rate}",
            *hs_rules_applied,
        ]

        return {
            # Phase 1: Port Arrival
            "price_rmb": price_rmb,
            "price_usd": round(price_usd, 4),
            "price_local": round(price_local, 4),
            "volume_cbm": round(effective_volume_cbm, 4),
            "sea_freight_cbm": sea_freight_cbm,
            "freight_per_unit": round(freight_per_unit, 2),
            "insurance_per_unit": round(insurance_per_unit, 2),
            "cif_per_unit": round(cif_per_unit, 2),
            # Phase 2: Customs & Tax
            "customs_per_unit": round(customs_per_unit, 2),
            "service_percent_per_unit": round(service_percent_per_unit, 2),
            "penalty_per_unit": round(penalty_per_unit, 2),
            "service_flat_301_line": round(service_flat_301_line, 2),  # JOD flat, shipment-level
            "vat_rate_020": vat_rate_020,
            "vat_base_per_unit": round(vat_base_per_unit, 2),
            "vat_per_unit": round(vat_per_unit, 2),
            "landed_cost_per_unit": round(landed_cost_per_unit, 2),
            # Metadata
            "hs_code_matched": hs_code_matched,
            "exchange_rate_used": cny_to_target,
            "quantity": quantity,
            "destination_port": destination_port,
            "currency": currency_upper,
            "rules_applied": applied_rules,
            # Backward-compat fields (set to Phase 2 values, Phase 3 will be in calculate())
            "clearance_per_unit": 0.0,  # Phase 3
            "commission_per_unit": 0.0,  # Phase 3
            "total_per_unit": round(landed_cost_per_unit, 2),  # Phase 2 total (excl. 301 which is shipment-level)
            "grand_total": round(landed_cost_per_unit * quantity, 2),  # Phase 2 total × qty (excl. 301)
        }

    # ═══════════════════════════════════════════════════════════
    # Main Multi-Product Calculation (All 3 Phases)
    # ═══════════════════════════════════════════════════════════

    def calculate(
        self,
        rfq_id: str,
        target_currency: str,
        destination_port: str,
        products: list[LineItemInput],
        agent_commission_pct: float = 3.0,
    ) -> dict:
        """Run full 3-phase pricing calculation for a set of products.

        Args:
            rfq_id: RFQ UUID.
            target_currency: Target currency code (JOD, USD).
            destination_port: Destination port name.
            products: List of product line items.
            agent_commission_pct: Commission percentage (default 3.0%).

        Returns:
            Dict with line_items, 3-phase breakdown, grand_total, etc.
        """
        ctx = PricingContext(
            rfq_id=rfq_id,
            target_currency=target_currency.upper(),
            destination_port=destination_port,
        )

        line_items: list[LineItemResult] = []
        grand_total_phase2 = 0.0  # Sum of Phase 2 landed costs (per line × qty, excl. 301)
        total_price_jod = 0.0  # Sum of FOB values for MOQ discount base
        total_cif_value = 0.0
        total_customs_duty = 0.0
        total_vat = 0.0
        total_vat_base = 0.0
        total_freight = 0.0
        total_insurance = 0.0
        total_service_percent = 0.0
        total_penalty = 0.0
        service_flat_301_candidates: list[float] = []

        # ════════════════════════════════════════════
        # Phase 1 & 2: Per-Product Calculation
        # ════════════════════════════════════════════
        for product in products:
            lc = self.calculate_landed_cost(
                price_rmb=product.unit_price_cny,
                weight_kg=product.weight_kg,
                quantity=product.quantity,
                destination_port=destination_port,
                currency=target_currency,
                agent_commission_pct=agent_commission_pct,
                hs_entry=product.hs_entry,
                has_license=product.has_license,
                volume_cbm=product.volume_cbm,
            )

            line_price_jod = lc["price_local"] * product.quantity
            line_cif = lc["cif_per_unit"] * product.quantity
            line_customs = lc["customs_per_unit"] * product.quantity
            line_vat = lc["vat_per_unit"] * product.quantity
            line_vat_base = lc["vat_base_per_unit"] * product.quantity
            line_landed = lc["landed_cost_per_unit"] * product.quantity

            line_item = LineItemResult(
                product_id=product.product_id,
                product_name=product.product_name,
                quantity=product.quantity,
                unit_price_cny=product.unit_price_cny,
                exchange_rate=lc["exchange_rate_used"],
                unit_price_converted=lc["price_local"],
                freight_cost=lc["freight_per_unit"] * product.quantity,
                insurance_cost=lc["insurance_per_unit"] * product.quantity,
                cif_value=line_cif,
                customs_duty=line_customs,
                clearance_fee=0.0,  # Phase 3 — allocated below
                commission=0.0,     # Phase 3 — allocated below
                subtotal=round(line_vat_base, 2),  # Phase 2 charges before VAT (CIF + duty + 070 + 018)
                discount=0.0,       # Phase 3 — allocated below
                total=round(line_landed, 2),  # Phase 2 total (excl. 301)
                service_flat_301=0.0,  # 301 is shipment-level
                service_percent_070=round(lc["service_percent_per_unit"] * product.quantity, 2),
                penalty_018=round(lc["penalty_per_unit"] * product.quantity, 2),
                hs_code_matched=lc["hs_code_matched"],
                vat_cost=round(line_vat, 2),
                vat_base=round(line_vat_base, 2),
                landed_cost=round(line_landed, 2),
            )
            line_items.append(line_item)

            total_price_jod += line_price_jod
            total_cif_value += line_cif
            total_customs_duty += line_customs
            total_vat += line_vat
            total_vat_base += line_vat_base
            grand_total_phase2 += line_landed
            total_freight += lc["freight_per_unit"] * product.quantity
            total_insurance += lc["insurance_per_unit"] * product.quantity
            total_service_percent += lc["service_percent_per_unit"] * product.quantity
            total_penalty += lc["penalty_per_unit"] * product.quantity
            service_flat_301_candidates.append(lc["service_flat_301_line"])

            ctx.rules_applied.extend(lc["rules_applied"])

        # ════════════════════════════════════════════
        # Phase 2: 301 flat fee (shipment-level, max across lines)
        # ════════════════════════════════════════════
        service_flat_301_total = max(service_flat_301_candidates, default=0.0)

        # Add 301 to VAT base (Bug 1 fix: 301 is always in VAT base)
        # VAT on 301 = 301 * vat_rate
        # Use the first line item's VAT rate (or global) for the 301 VAT
        first_vat_rate = None
        if line_items and line_items[0].vat_base > 0:
            first_vat_rate = line_items[0].vat_cost / line_items[0].vat_base if line_items[0].vat_base else None
        if first_vat_rate is None:
            first_vat_rate = self._get_rule_value("vat_rate", 0.16)
        vat_on_301 = service_flat_301_total * first_vat_rate

        # Add 301 and its VAT to the Phase 2 totals
        total_vat_base += service_flat_301_total
        total_vat += vat_on_301
        grand_total_phase2 += service_flat_301_total + vat_on_301

        # ════════════════════════════════════════════
        # Phase 3: Commercial Pricing
        # ════════════════════════════════════════════
        ctx.vat_rate = first_vat_rate

        # Local costs (clearance fee in JOD — Bug 4 fix)
        clearance_fee_total = self._get_rule_value("clearance_fee", 150.0)
        local_costs = clearance_fee_total  # + inland_transport when available

        # MOQ discount (Phase 3 — Bug 2 fix: applied after govt costs, on FOB price)
        moq_rate = self._calculate_moq_discount(ctx, sum(p.quantity for p in products))
        moq_discount = total_price_jod * moq_rate

        # Total base before commission
        total_base = grand_total_phase2 + local_costs
        discounted = total_base - moq_discount

        # Commission (Phase 3 — Bug 2 fix: applied after MOQ discount)
        commission_pct = agent_commission_pct / 100.0
        commission_total = discounted * commission_pct

        # Grand total (Phase 3 final)
        grand_total = discounted + commission_total

        # ════════════════════════════════════════════
        # Allocate Phase 3 values to line items
        # ════════════════════════════════════════════
        if line_items and grand_total_phase2 > 0:
            for li in line_items:
                # Proportion of this line's Phase 2 cost in total Phase 2 cost
                share = li.landed_cost / grand_total_phase2 if grand_total_phase2 > 0 else 0

                # Allocate clearance fee proportionally
                li.clearance_fee = round(clearance_fee_total * share, 2)

                # Allocate MOQ discount proportionally to FOB value
                li_fob = li.unit_price_converted * li.quantity
                fob_share = li_fob / total_price_jod if total_price_jod > 0 else 0
                li.discount = round(moq_discount * fob_share, 2)

                # Allocate commission proportionally
                li_after_discount = li.landed_cost + li.clearance_fee - li.discount
                line_discounted_share = li_after_discount / discounted if discounted > 0 else 0
                li.commission = round(commission_total * line_discounted_share, 2)

                # Line item final total (Phase 2 + Phase 3 allocation)
                li.total = round(li.landed_cost + li.clearance_fee - li.discount + li.commission, 2)

        # Custom (non-canonical) pricing rules
        custom_fees_total, custom_rules_applied = self._apply_custom_rules(products, line_items, ctx)

        # Early payment discount
        early_discount_rate = self._early_payment_discount(ctx)
        early_discount = grand_total * early_discount_rate

        discount_total = moq_discount + early_discount

        # Final total after all adjustments
        final_total = grand_total - early_discount + custom_fees_total

        # Target margin check
        self._target_margin(ctx)

        # Build 3-phase breakdown per line item
        three_phase_breakdown = []
        for li in line_items:
            three_phase_breakdown.append({
                "product_id": li.product_id,
                "phase_1_duty": round(li.customs_duty, 2),
                "phase_2_service": round(li.service_percent_070 + li.service_flat_301, 2),
                "phase_3_vat_penalty": round(li.vat_cost + li.penalty_018, 2),
            })

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
                    "vat_cost": li.vat_cost,
                    "vat_base": li.vat_base,
                    "landed_cost": li.landed_cost,
                }
                for li in line_items
            ],
            "subtotal_before_vat": round(total_vat_base, 2),
            "vat": round(total_vat, 2),
            "early_payment_discount": round(early_discount, 2),
            "grand_total": round(final_total, 2),
            "discount_total": round(discount_total, 2),
            "rules_applied": list(set(ctx.rules_applied)),
            "service_flat_fee_301_total": round(service_flat_301_total, 2),
            "custom_fees_total": round(custom_fees_total, 2),
            "custom_rules_applied": custom_rules_applied,
            "three_phase_breakdown": three_phase_breakdown,
        }

    # ═══════════════════════════════════════════════════════════
    # Custom (non-canonical) Pricing Rules
    # ═══════════════════════════════════════════════════════════

    def _apply_custom_rules(
        self,
        products: list[LineItemInput],
        line_items: list[LineItemResult],
        ctx: PricingContext,
    ) -> tuple[float, list[dict]]:
        """Apply admin-created rules whose name isn't a canonical DEFAULTS key.

        - percentage: value% of the total commercial goods subtotal (across all lines).
        - fixed: flat amount charged once per shipment.
        - formula: evaluated per line against that line's variables, then summed.
          A bad/erroring formula is skipped (contributes 0) rather than failing
          the whole calculation.
        """
        total_fees = 0.0
        applied: list[dict] = []
        goods_subtotal = sum(li.subtotal for li in line_items)

        for rule in self.custom_rules:
            if not rule.rule_type:
                continue

            if rule.rule_type == "percentage":
                amount = goods_subtotal * (rule.value / 100.0)
            elif rule.rule_type == "fixed":
                amount = rule.value
            elif rule.rule_type == "formula":
                amount = 0.0
                if not rule.formula:
                    ctx.rules_applied.append(f"custom:{rule.name}:error=missing_formula")
                    continue
                try:
                    for product, li in zip(products, line_items):
                        context = {
                            "unit_price_cny": product.unit_price_cny,
                            "unit_price_usd": product.unit_price_cny * self._get_rule_value("exchange_rate_cny_usd", 0.14),
                            "unit_price_local": li.unit_price_converted,
                            "quantity": product.quantity,
                            "weight_kg": product.weight_kg,
                            "total_weight_kg": product.weight_kg * product.quantity,
                            "cbm": self._compute_effective_volume_cbm(product.weight_kg, product.quantity, product.volume_cbm),
                            "freight": li.freight_cost,
                            "insurance": li.insurance_cost,
                            "cif": li.cif_value,
                            "customs": li.customs_duty,
                            "clearance": li.clearance_fee,
                            "commission": li.commission,
                            "exchange_rate": li.exchange_rate,
                            "subtotal": li.subtotal,
                            "line_total": li.total,
                        }
                        amount += evaluate_formula(rule.formula, context)
                except FormulaError as exc:
                    logger.warning(
                        "Custom formula rule failed to evaluate, skipping",
                        extra={"rule_name": rule.name, "error": str(exc)},
                    )
                    ctx.rules_applied.append(f"custom:{rule.name}:error=skipped")
                    continue
            else:
                continue

            total_fees += amount
            ctx.rules_applied.append(f"custom:{rule.name}({rule.rule_type})={amount:.2f}")
            applied.append({"name": rule.name, "rule_type": rule.rule_type, "amount": round(amount, 2)})

        return total_fees, applied

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
