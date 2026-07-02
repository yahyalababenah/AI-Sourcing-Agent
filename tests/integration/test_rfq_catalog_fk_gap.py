"""
AI-Sourcing Hub — RFQ ↔ CatalogProduct FK Gap (PRIORITY per test-planning brief)

Documents a real design gap rather than working around it: ``RFQ`` and
``Product`` (app/modules/intake/models.py) have no foreign key to
``CatalogProduct``. The only FK link is on
``QuotationLineItem.catalog_product_id`` (migration
014_add_catalog_product_id_to_line_items.py), which is populated only once a
quotation has actually been built for a product — nothing links an RFQ or
its Products to a catalog listing before that point.

Consequence demonstrated below: recovering "which catalog product does this
RFQ's Product correspond to" requires guessing (e.g. by name), and that guess
is genuinely ambiguous whenever more than one supplier's catalog has a
product with a matching name — there is no way to know which one the
matching engine or a human actually meant.
"""
import pytest
from sqlalchemy import inspect

from app.modules.intake.models import Product, RFQ
from app.modules.pricing.models import QuotationLineItem


class TestForeignKeyGapExistsOnModels:
    """Static/schema-level confirmation the FK genuinely doesn't exist."""

    def test_rfq_has_no_catalog_product_id_column(self):
        columns = {c.name for c in RFQ.__table__.columns}
        assert "catalog_product_id" not in columns

    def test_product_has_no_catalog_product_id_column(self):
        columns = {c.name for c in Product.__table__.columns}
        assert "catalog_product_id" not in columns

    def test_quotation_line_item_is_the_only_place_the_fk_exists(self):
        columns = {c.name for c in QuotationLineItem.__table__.columns}
        assert "catalog_product_id" in columns

    def test_rfq_has_no_relationship_named_catalog_product(self):
        mapper = inspect(RFQ)
        relationship_names = {rel.key for rel in mapper.relationships}
        assert "catalog_product" not in relationship_names
        assert "catalog_products" not in relationship_names


@pytest.mark.asyncio
class TestRecoveringCatalogProductFromRfqIsAmbiguous:
    """Simulates trying to answer "which catalog product did this RFQ's
    Product resolve to?" without the FK, using the only signal available —
    matching by product name — and shows it can't be done unambiguously.
    """

    async def test_no_direct_path_exists_before_a_quotation_is_built(
        self, db_session, make_rfq, make_product,
    ):
        """Immediately after RFQ/Product creation (before any quotation line
        item exists), there is *no* query — FK-based or otherwise reliable —
        that recovers a specific CatalogProduct. The only FK that could do
        this (QuotationLineItem.catalog_product_id) doesn't exist yet."""
        rfq = await make_rfq()
        product = await make_product(rfq=rfq, name="Industrial LED Floodlight 100W")
        await db_session.flush()

        # No column on Product to join through — this isn't a "query it
        # differently" problem, the join target genuinely doesn't exist.
        assert not hasattr(product, "catalog_product_id")
        assert not hasattr(product, "catalog_product")

    async def test_name_based_matching_is_ambiguous_with_multiple_suppliers(
        self, db_session, make_rfq, make_product, make_catalog_product, make_user,
    ):
        """Two different suppliers list a product with the identical name —
        entirely plausible for a common item like a floodlight. Without an
        FK, a name-based lookup for "the" catalog product returns both,
        with no principled way to pick the right one."""
        rfq = await make_rfq()
        product_name = "Industrial LED Floodlight 100W"
        await make_product(rfq=rfq, name=product_name)

        supplier_a = await make_user(role="agent", email="supplier_a@example.com")
        supplier_b = await make_user(role="agent", email="supplier_b@example.com")
        await make_catalog_product(supplier=supplier_a, product_name=product_name, unit_price_rmb=40.0)
        await make_catalog_product(supplier=supplier_b, product_name=product_name, unit_price_rmb=55.0)
        await db_session.flush()

        from sqlalchemy import select

        from app.modules.catalog.models import CatalogProduct

        result = await db_session.execute(
            select(CatalogProduct).where(CatalogProduct.product_name == product_name)
        )
        candidates = result.scalars().all()

        # This is the gap: two equally-plausible candidates, no FK to
        # disambiguate which (if either) this RFQ's product actually refers to.
        assert len(candidates) == 2
        assert {c.supplier_id for c in candidates} == {supplier_a.id, supplier_b.id}

    async def test_fk_only_becomes_resolvable_after_a_quotation_line_item_exists(
        self, db_session, make_rfq, make_product, make_catalog_product,
        make_quotation, make_user,
    ):
        """Once a quotation is actually built referencing a specific catalog
        product, THAT line item (and only that one) has a resolvable FK —
        proving the gap is specifically "before quotation time", not that
        the link can never exist."""
        rfq = await make_rfq()
        product = await make_product(rfq=rfq, name="Industrial LED Floodlight 100W")
        supplier = await make_user(role="agent")
        catalog_product = await make_catalog_product(
            supplier=supplier, product_name=product.name,
        )
        quotation = await make_quotation(rfq=rfq)

        line_item = QuotationLineItem(
            quotation_id=quotation.id,
            product_id=product.id,
            catalog_product_id=catalog_product.id,
            product_name=product.name,
            quantity=10,
            unit_price_cny=45.0,
            unit_price_converted=4.5,
            exchange_rate_used=0.1,
            subtotal=45.0,
            total=45.0,
        )
        db_session.add(line_item)
        await db_session.flush()

        assert line_item.catalog_product_id == catalog_product.id
        # But the RFQ/Product themselves still have no such link — the FK
        # exists only on this one line item, not as a general RFQ property.
        assert not hasattr(product, "catalog_product_id")
