#!/usr/bin/env python3
"""
AI-Sourcing Hub — Populate ChromaDB with Chinese Supplier Data

Seeds the vector database with initial Chinese supplier/product embeddings
for semantic search during sourcing.

Usage:
    python -m scripts.populate_chroma
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import argparse
import asyncio
import json
from typing import Optional

from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Sample Supplier Data
# ═══════════════════════════════════════════════════════════

SAMPLE_SUPPLIERS = [
    {
        "name": " Guangzhou Yihua Trading Co., Ltd.",
        "chinese_name": "广州市益华贸易有限公司",
        "products": ["soap", "detergent", "cleaning products"],
        "chinese_products": ["肥皂", "洗涤剂", "清洁用品"],
        "min_order": 1000,
        "port": "Guangzhou",
        "rating": 4.5,
    },
    {
        "name": "Shenzhen Xinhe Electronics Co., Ltd.",
        "chinese_name": "深圳鑫和电子有限公司",
        "products": ["electronic components", "cables", "adapters"],
        "chinese_products": ["电子元件", "电缆", "适配器"],
        "min_order": 500,
        "port": "Shenzhen",
        "rating": 4.8,
    },
    {
        "name": "Yiwu Chenxi Import & Export Co., Ltd.",
        "chinese_name": "义乌晨熙进出口有限公司",
        "products": ["textiles", "garments", "fabric"],
        "chinese_products": ["纺织品", "服装", "布料"],
        "min_order": 2000,
        "port": "Ningbo",
        "rating": 4.2,
    },
    {
        "name": "Qingdao Haishun Foodstuff Co., Ltd.",
        "chinese_name": "青岛海顺食品有限公司",
        "products": ["canned food", "frozen seafood", "snacks"],
        "chinese_products": ["罐头食品", "冷冻海鲜", "零食"],
        "min_order": 5000,
        "port": "Qingdao",
        "rating": 4.6,
    },
    {
        "name": "Shanghai Baosheng Machinery Co., Ltd.",
        "chinese_name": "上海宝盛机械有限公司",
        "products": ["industrial machinery", "pumps", "valves"],
        "chinese_products": ["工业机械", "泵", "阀门"],
        "min_order": 100,
        "port": "Shanghai",
        "rating": 4.7,
    },
]


# ═══════════════════════════════════════════════════════════
# Populate
# ═══════════════════════════════════════════════════════════

async def populate_chroma(
    chroma_host: str = "chromadb",
    chroma_port: int = 8000,
    collection_name: str = "suppliers",
    clear_first: bool = False,
):
    """Populate ChromaDB with sample supplier data.

    Args:
        chroma_host: ChromaDB host.
        chroma_port: ChromaDB port.
        collection_name: Collection name.
        clear_first: Whether to clear existing data first.
    """
    try:
        import chromadb
        from chromadb.config import Settings
    except ImportError:
        logger.error(
            "chromadb is not installed. Install with: pip install chromadb"
        )
        return

    client = chromadb.HttpClient(
        host=chroma_host,
        port=chroma_port,
        settings=Settings(allow_reset=True, anonymized_telemetry=False),
    )

    # Get or create collection
    try:
        if clear_first:
            try:
                client.delete_collection(collection_name)
                logger.info("Cleared existing collection: %s", collection_name)
            except Exception:
                pass

        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
    except Exception as exc:
        logger.error("Failed to create collection: %s", exc)
        return

    # Add supplier documents
    ids = []
    metadatas = []
    documents = []

    for i, supplier in enumerate(SAMPLE_SUPPLIERS):
        doc_text = (
            f"Supplier: {supplier['name']}\n"
            f"Chinese Name: {supplier['chinese_name']}\n"
            f"Products: {', '.join(supplier['chinese_products'])}\n"
            f"Min Order: {supplier['min_order']}\n"
            f"Port: {supplier['port']}"
        )

        ids.append(f"supplier_{i}")
        metadatas.append({
            "name": supplier["name"],
            "chinese_name": supplier["chinese_name"],
            "port": supplier["port"],
            "rating": supplier["rating"],
            "min_order": supplier["min_order"],
        })
        documents.append(doc_text)

    collection.add(
        ids=ids,
        metadatas=metadatas,
        documents=documents,
    )

    logger.info(
        "Seeded ChromaDB collection '%s' with %d suppliers",
        collection_name,
        len(SAMPLE_SUPPLIERS),
    )


# ═══════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Populate ChromaDB with Chinese supplier data"
    )
    parser.add_argument(
        "--host", default="chromadb", help="ChromaDB host"
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="ChromaDB port"
    )
    parser.add_argument(
        "--collection", default="suppliers", help="Collection name"
    )
    parser.add_argument(
        "--clear", action="store_true", help="Clear existing data first"
    )
    args = parser.parse_args()

    asyncio.run(
        populate_chroma(
            chroma_host=args.host,
            chroma_port=args.port,
            collection_name=args.collection,
            clear_first=args.clear,
        )
    )
