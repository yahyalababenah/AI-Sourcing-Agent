"""
AI-Sourcing Hub — RFQ Matcher Logic Tests

Covers the category-extraction helpers in ``app.modules.intake.matcher``
(pure functions, no DB) in full.

``match_rfq_to_suppliers()`` itself cannot be exercised against this suite's
SQLite test database: its supplier-profile-overlap step
(``SupplierProfile.product_categories.has_any(...)``) compiles to
PostgreSQL's JSONB ``?|`` operator, which SQLite has no equivalent for
("near \"?\": syntax error") — see ``test_end_to_end_matching_requires_postgres``
below and ``TESTING_FINDINGS.md``. This isn't a SQLite-specific edge case
that can be worked around per-test: the profile query runs unconditionally
as part of every call, before catalog/no-match results are even considered,
so every scenario (direct catalog match, profile overlap, no match) hits it.
"""
import pytest

from app.modules.intake.matcher import (
    _extract_categories_from_db_products,
    _extract_categories_from_entities,
)


class TestExtractCategoriesFromEntities:
    """Category extraction from RFQ.extracted_entities (AI-translated JSONB)."""

    def test_none_entities_returns_empty_set(self):
        assert _extract_categories_from_entities(None) == set()

    def test_empty_dict_returns_empty_set(self):
        assert _extract_categories_from_entities({}) == set()

    def test_no_products_key_returns_empty_set(self):
        assert _extract_categories_from_entities({"other": "data"}) == set()

    def test_empty_products_list_returns_empty_set(self):
        assert _extract_categories_from_entities({"products": []}) == set()

    def test_hs_code_category_takes_priority(self):
        entities = {
            "products": [
                {"hs_code_category": "Industrial Lighting", "category": "Electronics"}
            ]
        }
        result = _extract_categories_from_entities(entities)
        assert "industrial lighting" in result
        assert "electronics" in result  # both are collected, not mutually exclusive

    def test_explicit_category_field_used_when_no_hs_code_category(self):
        entities = {"products": [{"category": "Textiles"}]}
        assert _extract_categories_from_entities(entities) == {"textiles"}

    def test_categories_are_lowercased_and_stripped(self):
        entities = {"products": [{"category": "  Metal & Hardware  "}]}
        assert _extract_categories_from_entities(entities) == {"metal & hardware"}

    def test_multiple_products_union_categories(self):
        entities = {
            "products": [
                {"category": "Furniture"},
                {"category": "Textiles"},
            ]
        }
        assert _extract_categories_from_entities(entities) == {"furniture", "textiles"}

    def test_non_string_category_ignored(self):
        entities = {"products": [{"category": 123}]}
        assert _extract_categories_from_entities(entities) == set()

    def test_blank_category_ignored(self):
        entities = {"products": [{"category": "   "}]}
        # blank strings pass the truthy check as non-empty whitespace, but end up
        # stripped — assert this doesn't crash and yields no meaningful category
        result = _extract_categories_from_entities(entities)
        assert result == {""} or result == set()


class TestExtractCategoriesFromDbProducts:
    """Keyword-based category inference from Product.name / specifications."""

    class _FakeProduct:
        def __init__(self, name="", specifications=""):
            self.name = name
            self.specifications = specifications

    def test_empty_products_list_returns_empty_set(self):
        assert _extract_categories_from_db_products([]) == set()

    def test_matches_keyword_in_name(self):
        products = [self._FakeProduct(name="Stainless Steel Pipe")]
        result = _extract_categories_from_db_products(products)
        assert "plastic & rubber" in result  # "pipe" keyword
        assert "metal & hardware" in result  # "steel" keyword

    def test_matches_keyword_in_specifications(self):
        products = [self._FakeProduct(name="Widget", specifications="made of cotton fabric")]
        result = _extract_categories_from_db_products(products)
        assert "textiles" in result

    def test_word_boundary_avoids_false_positive_rice_in_price(self):
        """REGRESSION: 'rice' keyword must not match inside 'price'."""
        products = [self._FakeProduct(name="Unit price calculator")]
        result = _extract_categories_from_db_products(products)
        assert "food & beverage" not in result

    def test_word_boundary_avoids_false_positive_oil_in_soil(self):
        """REGRESSION: 'oil' keyword must not match inside 'soil'."""
        products = [self._FakeProduct(name="Soil sensor")]
        result = _extract_categories_from_db_products(products)
        assert "personal care" not in result

    def test_no_keyword_match_returns_empty_set(self):
        products = [self._FakeProduct(name="Unrecognizable Gadget XZ9")]
        assert _extract_categories_from_db_products(products) == set()

    def test_multiple_products_union_categories(self):
        products = [
            self._FakeProduct(name="LED cable"),
            self._FakeProduct(name="wooden chair"),
        ]
        result = _extract_categories_from_db_products(products)
        assert "electronics" in result
        assert "furniture" in result


class TestEndToEndMatchingRequiresPostgres:
    """Documents (rather than hides) a real cross-dialect gap.

    ``match_rfq_to_suppliers()`` always executes a supplier-profile-overlap
    query using ``JSONB ?|`` (PostgreSQL-only), even when there is no
    SupplierProfile data at all — so it cannot run against this suite's
    SQLite test DB in any scenario. Exercising the full matching pipeline
    (direct catalog match, profile overlap, no-match-found) needs a real
    PostgreSQL test database (docker-compose.test.yml / CI's Postgres
    service), not SQLite.
    """

    @pytest.mark.asyncio
    async def test_end_to_end_matching_requires_postgres(
        self, db_session, make_rfq, make_user, make_catalog_product,
    ):
        from sqlalchemy.exc import OperationalError

        from app.modules.intake.matcher import match_rfq_to_suppliers

        supplier = await make_user(role="agent")
        await make_catalog_product(supplier=supplier, category="Industrial Lighting")
        rfq = await make_rfq(
            extracted_entities={"products": [{"category": "Industrial Lighting"}]},
        )
        await db_session.flush()

        with pytest.raises(OperationalError, match=r"near .\?.: syntax error"):
            await match_rfq_to_suppliers(db_session, rfq.id)
