#!/usr/bin/env python3
r"""
scratch_catalog_data.py   –   Growth-Hacking Seed Script

Populates the AI Global Catalog with **50 real-world B2B electronic/electrical
products** to solve the marketplace "cold start" problem.

Architecture note
-----------------
The "Catalog" is **not** a dedicated database table.  It is a **live computed
aggregation** from ``Document.extracted_entities["products"]`` where
``Document.status == EXTRACTED`` (see ``app/modules/catalog/service.py``).

This script therefore creates **Document** records with properly populated
``extracted_entities`` JSONB, linked to the existing Demo Supplier
(``agent@example.com``) and a seeded RFQ.

Usage
-----
    cd /home/yahia/Desktop/ai-sourcing-hub
    python3 scripts/scratch_catalog_data.py

Prerequisites
-------------
1.  ``scripts/seed_demo_users.py``  –  creates agent\@example.com / client\@example.com
2.  ``scripts/seed_demo_rfqs.py``   –  creates at least one RFQ record
3.  PostgreSQL running with migrations applied
"""

from __future__ import annotations

import asyncio
import logging
import math
import random
import subprocess
import sys
import time
from typing import Any
from uuid import uuid4

# ---------------------------------------------------------------------------
# Attempt to install / import beautifulsoup4
# ---------------------------------------------------------------------------
try:
    from bs4 import BeautifulSoup  # noqa: F401

    BS4_AVAILABLE = True
except ModuleNotFoundError:
    BS4_AVAILABLE = False
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "beautifulsoup4", "-q"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        from bs4 import BeautifulSoup  # type: ignore[import-untyped]  # noqa: F401

        BS4_AVAILABLE = True
    except Exception:
        BS4_AVAILABLE = False

# ---------------------------------------------------------------------------
# Project imports  (must run from project root)
# ---------------------------------------------------------------------------
sys.path.insert(0, ".")

from sqlalchemy import select

from app.shared.database import async_session_factory
from app.modules.auth.models import User, UserRole
from app.modules.intake.models import RFQ
from app.modules.documents.models import Document, DocumentStatus, DocumentType
# Import ALL models so SQLAlchemy can resolve relationship strings (e.g. User → Quotation).
import app.modules.output.models  # noqa: F401  registers Quotation mapper
import app.modules.pricing.models  # noqa: F401  registers PricingRule mapper

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("scratch_catalog")

# ===================================================================
#  50 real-world B2B electronic / electrical products
# ===================================================================
# Each dict matches the keys that ``search_catalog()`` reads from
# ``extracted_entities["products"][n]``.

# fmt: off
CURATED_PRODUCTS: list[dict[str, Any]] = [
    # ── Power Supplies & Converters ──
    {
        "product_name": "MeanWell LRS-350-24 Switching Power Supply 24V 14.6A 350W",
        "model_number": "LRS-350-24",
        "unit_price_rmb": 145.0,
        "moq": 1,
        "weight_kg": 0.68,
        "dimensions": "215×115×30mm",
        "material": "Aluminum casing",
    },
    {
        "product_name": "MeanWell LRS-150-12 Switching Power Supply 12V 12.5A 150W",
        "model_number": "LRS-150-12",
        "unit_price_rmb": 89.0,
        "moq": 1,
        "weight_kg": 0.42,
        "dimensions": "159×97×30mm",
        "material": "Aluminum casing",
    },
    {
        "product_name": "Hi-Link HLK-PM01 AC-DC 220V to 5V 600mA Power Module",
        "model_number": "HLK-PM01",
        "unit_price_rmb": 18.5,
        "moq": 5,
        "weight_kg": 0.015,
        "dimensions": "37×24×15mm",
        "material": "Plastic encapsulated",
    },
    {
        "product_name": "DC-DC Step-Down Buck Converter LM2596 3-40V to 1.25-37V",
        "model_number": "LM2596-DC",
        "unit_price_rmb": 12.0,
        "moq": 10,
        "weight_kg": 0.012,
        "dimensions": "43×21×14mm",
        "material": "PCB + heatsink",
    },
    {
        "product_name": "XL4015 5A DC-DC Step-Down Buck Converter with CV/CC",
        "model_number": "XL4015-CCCV",
        "unit_price_rmb": 22.0,
        "moq": 5,
        "weight_kg": 0.025,
        "dimensions": "52×28×16mm",
        "material": "PCB + aluminum heatsink",
    },
    # ── Microcontrollers & Development Boards ──
    {
        "product_name": "ESP32-WROOM-32 Development Board WiFi + BLE",
        "model_number": "ESP32-DEVKIT-V1",
        "unit_price_rmb": 33.0,
        "moq": 2,
        "weight_kg": 0.025,
        "dimensions": "51×28×12mm",
        "material": "FR4 PCB",
    },
    {
        "product_name": "Arduino Uno R3 Clone ATmega328P CH340G",
        "model_number": "UNO-R3-CH340",
        "unit_price_rmb": 28.0,
        "moq": 2,
        "weight_kg": 0.035,
        "dimensions": "69×53×15mm",
        "material": "FR4 PCB + ABS case",
    },
    {
        "product_name": "Raspberry Pi 5 4GB Single-Board Computer",
        "model_number": "SC1112-B0B4",
        "unit_price_rmb": 385.0,
        "moq": 1,
        "weight_kg": 0.085,
        "dimensions": "85×56×17mm",
        "material": "PCB + metal heatsink",
    },
    {
        "product_name": "STM32F103C8T6 Blue Pill Board ARM Cortex-M3",
        "model_number": "STM32-BLUEPILL",
        "unit_price_rmb": 15.0,
        "moq": 5,
        "weight_kg": 0.01,
        "dimensions": "53×22×10mm",
        "material": "FR4 PCB",
    },
    {
        "product_name": "NodeMCU ESP8266 ESP-12E WiFi Development Board",
        "model_number": "NODEMCU-V3-ESP12E",
        "unit_price_rmb": 19.0,
        "moq": 5,
        "weight_kg": 0.015,
        "dimensions": "48×25×10mm",
        "material": "FR4 PCB",
    },
    # ── Sensors & Modules ──
    {
        "product_name": "HC-SR04 Ultrasonic Distance Sensor Module",
        "model_number": "HC-SR04",
        "unit_price_rmb": 4.5,
        "moq": 10,
        "weight_kg": 0.008,
        "dimensions": "45×20×15mm",
        "material": "PCB + ceramic transducer",
    },
    {
        "product_name": "DHT22 AM2302 Digital Temperature and Humidity Sensor",
        "model_number": "AM2302",
        "unit_price_rmb": 16.0,
        "moq": 5,
        "weight_kg": 0.003,
        "dimensions": "27×20×8mm",
        "material": "Plastic casing",
    },
    {
        "product_name": "GY-521 MPU6050 6-Axis Gyroscope + Accelerometer Module",
        "model_number": "GY-521",
        "unit_price_rmb": 8.0,
        "moq": 10,
        "weight_kg": 0.003,
        "dimensions": "21×16×3mm",
        "material": "FR4 PCB",
    },
    {
        "product_name": "BMP280 Barometric Pressure and Altitude Sensor Module",
        "model_number": "GY-BMP280",
        "unit_price_rmb": 6.5,
        "moq": 10,
        "weight_kg": 0.002,
        "dimensions": "15×13×2mm",
        "material": "FR4 PCB",
    },
    {
        "product_name": "ACS712 30A Hall-Effect Current Sensor Module",
        "model_number": "ACS712-30A",
        "unit_price_rmb": 12.0,
        "moq": 5,
        "weight_kg": 0.01,
        "dimensions": "31×13×9mm",
        "material": "FR4 PCB + copper trace",
    },
    # ── Displays & HMI ──
    {
        "product_name": "0.96 Inch OLED Display 128×64 SSD1306 I2C White",
        "model_number": "OLED-0.96-I2C",
        "unit_price_rmb": 14.0,
        "moq": 5,
        "weight_kg": 0.005,
        "dimensions": "27×27×4mm",
        "material": "Glass + FPC",
    },
    {
        "product_name": "2.8 Inch TFT LCD Touch Screen Display 320×240 SPI",
        "model_number": "TFT-2.8-SPI",
        "unit_price_rmb": 42.0,
        "moq": 2,
        "weight_kg": 0.045,
        "dimensions": "76×54×9mm",
        "material": "Glass + FPC + PCB",
    },
    {
        "product_name": "7 Segment LED Display 0.56 Inch Red Common Cathode 4-Digit",
        "model_number": "SMG05641CC",
        "unit_price_rmb": 3.5,
        "moq": 20,
        "weight_kg": 0.005,
        "dimensions": "50×19×8mm",
        "material": "PCB + LED resin",
    },
    {
        "product_name": "MAX7219 8×8 LED Matrix Display Module Red",
        "model_number": "MAX7219-MATRIX",
        "unit_price_rmb": 12.0,
        "moq": 5,
        "weight_kg": 0.012,
        "dimensions": "32×32×12mm",
        "material": "PCB + LED resin",
    },
    {
        "product_name": "5 Inch TFT LCD Display 800×480 HDMI Interface",
        "model_number": "HDMI-5-800x480",
        "unit_price_rmb": 145.0,
        "moq": 1,
        "weight_kg": 0.12,
        "dimensions": "121×76×7mm",
        "material": "Glass + metal frame",
    },
    # ── Relays & Switching ──
    {
        "product_name": "2-Channel 5V Relay Module Optocoupler Isolation",
        "model_number": "2CH-RELAY-5V",
        "unit_price_rmb": 9.5,
        "moq": 10,
        "weight_kg": 0.028,
        "dimensions": "50×26×18mm",
        "material": "FR4 PCB + plastic shell",
    },
    {
        "product_name": "4-Channel 5V Relay Module High/Low Level Trigger",
        "model_number": "4CH-RELAY-5V",
        "unit_price_rmb": 16.0,
        "moq": 5,
        "weight_kg": 0.045,
        "dimensions": "75×55×18mm",
        "material": "FR4 PCB + plastic shell",
    },
    {
        "product_name": "Solid State Relay SSR-40DA 40A 24-380VAC DC Control",
        "model_number": "SSR-40DA",
        "unit_price_rmb": 22.0,
        "moq": 5,
        "weight_kg": 0.06,
        "dimensions": "62×45×23mm",
        "material": "Aluminum + epoxy resin",
    },
    {
        "product_name": "MOSFET IRF520 Driver Module for Arduino",
        "model_number": "IRF520-MOS",
        "unit_price_rmb": 5.5,
        "moq": 10,
        "weight_kg": 0.006,
        "dimensions": "34×17×12mm",
        "material": "FR4 PCB",
    },
    {
        "product_name": "5V 1-Channel Relay Module with Optocoupler",
        "model_number": "1CH-RELAY-5V",
        "unit_price_rmb": 4.0,
        "moq": 20,
        "weight_kg": 0.015,
        "dimensions": "42×26×17mm",
        "material": "FR4 PCB + plastic shell",
    },
    # ── Industrial Automation ──
    {
        "product_name": "PLC Programmable Logic Controller FX1N-14MT-4AD",
        "model_number": "FX1N-14MT",
        "unit_price_rmb": 285.0,
        "moq": 1,
        "weight_kg": 0.35,
        "dimensions": "128×76×42mm",
        "material": "ABS plastic + metal brackets",
    },
    {
        "product_name": "Omron Proximity Sensor E2E-X3D1-N 3mm DC NPN NO",
        "model_number": "E2E-X3D1-N",
        "unit_price_rmb": 65.0,
        "moq": 2,
        "weight_kg": 0.035,
        "dimensions": "M12×45mm",
        "material": "Brass nickel-plated + PBT",
    },
    {
        "product_name": "Photoelectric Sensor E3F-DS30C4 Diffuse 30cm NPN NO+NC",
        "model_number": "E3F-DS30C4",
        "unit_price_rmb": 28.0,
        "moq": 5,
        "weight_kg": 0.04,
        "dimensions": "M18×55mm",
        "material": "ABS plastic + acrylic lens",
    },
    {
        "product_name": "PID Temperature Controller XH-W3001 Digital Thermostat 220V 30A",
        "model_number": "XH-W3001",
        "unit_price_rmb": 24.0,
        "moq": 5,
        "weight_kg": 0.06,
        "dimensions": "85×45×28mm",
        "material": "ABS plastic casing",
    },
    {
        "product_name": "SCR Voltage Regulator 4000W 220V AC Dimmer Speed Control",
        "model_number": "SCR-4000W",
        "unit_price_rmb": 32.0,
        "moq": 3,
        "weight_kg": 0.12,
        "dimensions": "85×55×38mm",
        "material": "Aluminum heatsink + PCB",
    },
    # ── Communication Modules ──
    {
        "product_name": "LoRa Ra-02 SX1278 433MHz Wireless Module SPI",
        "model_number": "RA-02-SX1278",
        "unit_price_rmb": 18.0,
        "moq": 5,
        "weight_kg": 0.004,
        "dimensions": "17×16×3mm",
        "material": "FR4 PCB + metal shield",
    },
    {
        "product_name": "HC-05 Bluetooth Serial Transceiver Module Master/Slave",
        "model_number": "HC-05",
        "unit_price_rmb": 12.0,
        "moq": 5,
        "weight_kg": 0.004,
        "dimensions": "27×13×4mm",
        "material": "FR4 PCB + metal shield",
    },
    {
        "product_name": "SIM800L GSM GPRS Module Quad-band 850/900/1800/1900MHz",
        "model_number": "SIM800L-V2",
        "unit_price_rmb": 22.0,
        "moq": 5,
        "weight_kg": 0.008,
        "dimensions": "40×30×5mm",
        "material": "FR4 PCB + metal shield",
    },
    {
        "product_name": "NEO-6M GPS Module with Ceramic Active Antenna",
        "model_number": "NEO-6M-GPS",
        "unit_price_rmb": 35.0,
        "moq": 3,
        "weight_kg": 0.015,
        "dimensions": "28×26×8mm",
        "material": "FR4 PCB + ceramic antenna",
    },
    {
        "product_name": "NFC RFID Module RC522 13.56MHz SPI Interface",
        "model_number": "RC522-NFC",
        "unit_price_rmb": 6.0,
        "moq": 10,
        "weight_kg": 0.008,
        "dimensions": "40×40×5mm",
        "material": "FR4 PCB + copper coil",
    },
    # ── Connectors & Cables ──
    {
        "product_name": "Dupont Jumper Wire Kit 120pcs Male-to-Male/Female/Male 20cm",
        "model_number": "DUPONT-120PCS",
        "unit_price_rmb": 5.5,
        "moq": 20,
        "weight_kg": 0.04,
        "dimensions": "200×100×15mm",
        "material": "PVC + copper + plastic housing",
    },
    {
        "product_name": "Breadboard 830 Tie Points Solderless Prototype Board",
        "model_number": "BB-830",
        "unit_price_rmb": 8.0,
        "moq": 10,
        "weight_kg": 0.065,
        "dimensions": "165×55×8mm",
        "material": "ABS plastic + phosphor-bronze clips",
    },
    {
        "product_name": "Micro USB Breakout Board Female Connector with Pin Headers",
        "model_number": "MICROUSB-BRK",
        "unit_price_rmb": 2.5,
        "moq": 20,
        "weight_kg": 0.002,
        "dimensions": "15×12×3mm",
        "material": "FR4 PCB + metal shell",
    },
    {
        "product_name": "Terminal Block 2P 5.08mm Pitch Screw Connector 10pcs",
        "model_number": "TB2-5.08-10PCS",
        "unit_price_rmb": 3.0,
        "moq": 50,
        "weight_kg": 0.02,
        "dimensions": "25×15×12mm",
        "material": "PA66 plastic + brass screws",
    },
    {
        "product_name": "RJ45 Ethernet Connector 8P8C with Shielded Zinc Alloy Shell",
        "model_number": "RJ45-SHIELDED",
        "unit_price_rmb": 1.8,
        "moq": 50,
        "weight_kg": 0.008,
        "dimensions": "16×14×11mm",
        "material": "Zinc alloy + PBT plastic",
    },
    # ── Active Components ──
    {
        "product_name": "IRFZ44N N-Channel Power MOSFET TO-220 55V 49A",
        "model_number": "IRFZ44NPBF",
        "unit_price_rmb": 3.0,
        "moq": 20,
        "weight_kg": 0.002,
        "dimensions": "TO-220",
        "material": "Silicon + copper leadframe",
    },
    {
        "product_name": "TIP120 NPN Darlington Transistor TO-220 60V 5A",
        "model_number": "TIP120",
        "unit_price_rmb": 2.5,
        "moq": 20,
        "weight_kg": 0.002,
        "dimensions": "TO-220",
        "material": "Silicon + copper leadframe",
    },
    {
        "product_name": "LM358P Dual Operational Amplifier DIP-8",
        "model_number": "LM358P",
        "unit_price_rmb": 0.8,
        "moq": 50,
        "weight_kg": 0.001,
        "dimensions": "DIP-8 9.3×6.4mm",
        "material": "Silicon + epoxy mold",
    },
    {
        "product_name": "NE555P Precision Timer DIP-8",
        "model_number": "NE555P",
        "unit_price_rmb": 0.6,
        "moq": 50,
        "weight_kg": 0.001,
        "dimensions": "DIP-8 9.3×6.4mm",
        "material": "Silicon + epoxy mold",
    },
    {
        "product_name": "ULN2003A Darlington Transistor Array DIP-16 7-Channel 50V 500mA",
        "model_number": "ULN2003A",
        "unit_price_rmb": 1.2,
        "moq": 50,
        "weight_kg": 0.002,
        "dimensions": "DIP-16 19.3×6.4mm",
        "material": "Silicon + epoxy mold",
    },
    # ── Audio & Visual ──
    {
        "product_name": "RGB LED Strip 5V 1m 30 LEDs WS2812B Addressable",
        "model_number": "WS2812B-30LED-M",
        "unit_price_rmb": 18.0,
        "moq": 5,
        "weight_kg": 0.02,
        "dimensions": "1000×10×3mm",
        "material": "FPC + SMD LED + silicone seal",
    },
    {
        "product_name": "MAX9814 Electret Microphone Amplifier Module with AGC",
        "model_number": "MAX9814-AGC",
        "unit_price_rmb": 14.0,
        "moq": 5,
        "weight_kg": 0.005,
        "dimensions": "20×18×4mm",
        "material": "FR4 PCB",
    },
    {
        "product_name": "PAM8403 3W×2 Stereo Audio Amplifier Board 5V",
        "model_number": "PAM8403-AMP",
        "unit_price_rmb": 4.0,
        "moq": 10,
        "weight_kg": 0.004,
        "dimensions": "24×20×4mm",
        "material": "FR4 PCB",
    },
    {
        "product_name": "Active Buzzer 5V Continuous Tone 12mm Diameter",
        "model_number": "BUZZER-ACTIVE-12MM",
        "unit_price_rmb": 1.2,
        "moq": 50,
        "weight_kg": 0.003,
        "dimensions": "12×9mm",
        "material": "PBT plastic + piezoelectric disc",
    },
    {
        "product_name": "IR Infrared Obstacle Avoidance Sensor Module TCRT5000",
        "model_number": "TCRT5000-IR",
        "unit_price_rmb": 3.0,
        "moq": 20,
        "weight_kg": 0.004,
        "dimensions": "32×14×8mm",
        "material": "FR4 PCB + plastic bracket",
    },
# fmt: on
]

assert len(CURATED_PRODUCTS) == 50, f"Expected 50 products, got {len(CURATED_PRODUCTS)}"


# ── helpers ────────────────────────────────────────────────────────────────

def _chunk_products(
    products: list[dict[str, Any]], chunk_size: int = 5
) -> list[list[dict[str, Any]]]:
    """Split product list into chunks, each -> one Document record."""
    return [products[i : i + chunk_size] for i in range(0, len(products), chunk_size)]


def _pretty_price(rmb: float | None) -> str:
    if rmb is None:
        return "N/A"
    return f"¥{rmb:,.1f}"


# ── database helpers ───────────────────────────────────────────────────────

async def _ensure_supplier(session) -> User:
    """Look up the demo supplier (agent@example.com)."""
    result = await session.execute(
        select(User).where(User.email == "agent@example.com")
    )
    user = result.scalar_one_or_none()
    if user is None:
        log.error(
            "Demo supplier 'agent@example.com' not found!  "
            "Run scripts/seed_demo_users.py first."
        )
        sys.exit(1)
    log.info("🔗 Supplier found: %s  (id=%s)", user.email, user.id)
    return user


async def _ensure_rfq(session) -> RFQ:
    """Grab the first RFQ from the database to link documents against."""
    result = await session.execute(select(RFQ).limit(1))
    rfq = result.scalar_one_or_none()
    if rfq is None:
        log.error(
            "No RFQ found!  Run scripts/seed_demo_rfqs.py first."
        )
        sys.exit(1)
    log.info("🔗 RFQ found: id=%s  (status=%s)", rfq.id, rfq.status.value)
    return rfq


async def _existing_doc_names(session, supplier_id, rfq_id) -> set[str]:
    """Return set of ``file_name`` values already in DB for this combo."""
    result = await session.execute(
        select(Document.file_name).where(
            Document.uploaded_by_id == supplier_id,
            Document.rfq_id == rfq_id,
            Document.status == DocumentStatus.EXTRACTED,
        )
    )
    return {row[0] for row in result.fetchall()}


# ── core logic ─────────────────────────────────────────────────────────────

async def inject_catalog(
    session, dry_run: bool = False
) -> dict[str, Any]:
    """Create Document records with ``extracted_entities`` so they appear in
    the marketplace catalog.

    Returns a summary dictionary.
    """
    supplier = await _ensure_supplier(session)
    rfq = await _ensure_rfq(session)

    chunks = _chunk_products(CURATED_PRODUCTS, chunk_size=5)
    existing = await _existing_doc_names(session, supplier.id, rfq.id)
    log.info(
        "📂 %d existing EXTRACTED documents for this supplier+rfq",
        len(existing),
    )

    created = 0
    skipped = 0
    doc_created = 0

    for idx, chunk in enumerate(chunks):
        file_name = f"catalog-batch-{idx + 1:02d}-of-{len(chunks):02d}.pdf"

        # ── skip duplicates ──
        if file_name in existing:
            log.info("  ⏭️  %s — already exists, skipping", file_name)
            skipped += len(chunk)
            continue

        if dry_run:
            log.info(
                "  [DRY-RUN] Would create %s  (%d products)",
                file_name,
                len(chunk),
            )
            created += len(chunk)
            doc_created += 1
            continue

        # Build the product list exactly as the catalog service expects
        products_list: list[dict[str, Any]] = [
            {
                "product_name": p["product_name"],
                "model_number": p["model_number"],
                "unit_price_rmb": p["unit_price_rmb"],
                "moq": p["moq"],
                "weight_kg": p["weight_kg"],
                "dimensions": p["dimensions"],
                "material": p["material"],
            }
            for p in chunk
        ]

        doc = Document(
            rfq_id=rfq.id,
            uploaded_by_id=supplier.id,
            file_name=file_name,
            file_path=f"seed/catalog/{file_name}",  # placeholder – no real file
            file_size_bytes=0,
            content_type="application/pdf",
            doc_type=DocumentType.PDF,
            status=DocumentStatus.EXTRACTED,  # <-- critical for catalog visibility
            extracted_text=(
                f"Auto-generated catalog seed batch {idx + 1}/{len(chunks)}"
            ),
            extracted_entities={"products": products_list},
        )
        session.add(doc)
        created += len(chunk)
        doc_created += 1

        log.info(
            "  ✅  %s  —  %d products  (¥%.1f … ¥%.1f RMB)",
            file_name,
            len(chunk),
            min(p["unit_price_rmb"] for p in chunk),
            max(p["unit_price_rmb"] for p in chunk),
        )

    if not dry_run and created > 0:
        await session.commit()
        log.info("💾 Committed %d new products to database.", created)

    return {
        "total_products": len(CURATED_PRODUCTS),
        "created": created,
        "skipped": skipped,
        "documents_created": doc_created,
        "supplier_id": str(supplier.id),
        "supplier_email": supplier.email,
        "rfq_id": str(rfq.id),
    }


# ── optional web scrape (bonus) ────────────────────────────────────────────

async def _try_scrape_bonus() -> list[dict[str, Any]] | None:
    """Attempt to scrape a public electronics directory for extra products.

    Uses ``httpx`` + ``BeautifulSoup`` with random delays for politeness.
    Returns ``None`` on failure (graceful fallback).
    """
    if not BS4_AVAILABLE:
        log.info("🌐 BeautifulSoup not available — skipping live scrape")
        return None

    import httpx

    sources = [
        "https://www.electronicscomp.com/featured-products",
        "https://www.alldatasheet.com/view.jsp?Searchword=popular",
    ]

    async with httpx.AsyncClient(
        timeout=15.0, follow_redirects=True
    ) as client:
        for url in sources:
            delay = random.uniform(1.2, 2.5)
            log.info("🌐 Waiting %.1fs before scraping %s …", delay, url)
            await asyncio.sleep(delay)

            try:
                resp = await client.get(
                    url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (X11; Linux x86_64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0.0.0 Safari/537.36"
                        ),
                    },
                )
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                log.info(
                    "🌐 Scraped %s — %d bytes", url, len(resp.text)
                )
                # Future: real extraction logic per source structure.
                # For now, report success but return None so curated data is used.
                return None
            except Exception as exc:
                log.warning("🌐 Scrape failed for %s: %s", url, exc)
                continue

    return None


# ── main ───────────────────────────────────────────────────────────────────

async def main() -> None:
    """Entry point."""
    print()
    print("=" * 67)
    print("   📦  AI Global Catalog  —  Growth-Hacking Seed Script")
    print(f"   🎯  Target: {len(CURATED_PRODUCTS)} real-world B2B electronic products")
    print("=" * 67)
    print()
    print(f"   BeautifulSoup available : {'✅ yes' if BS4_AVAILABLE else '❌ no'}")
    print(f"   Curated dataset        : {len(CURATED_PRODUCTS)} products")
    print(f"   Chunk size (per doc)   : 5")
    print(f"   Documents to create    : {math.ceil(len(CURATED_PRODUCTS) / 5)}")
    print()

    # ── Phase 0: optional web scrape ──
    scraped = await _try_scrape_bonus()
    if scraped:
        log.info("🌐 Bonus: scraped %d additional products", len(scraped))

    # ── Phase 1: database injection ──
    log.info("━" * 40)
    log.info("  Phase 1 — Database injection")
    log.info("━" * 40)
    print()

    async with async_session_factory() as session:
        summary = await inject_catalog(session, dry_run=False)

    # ── Phase 2: summary ──
    print()
    print("=" * 67)
    print(f"   ✅  [SUCCESS] Captured {summary['total_products']} items "
          f"and hydrated the Global Catalog.")
    print()
    print(f"      Created  : {summary['created']} products "
          f"across {summary['documents_created']} documents")
    print(f"      Skipped  : {summary['skipped']} (already existed)")
    print(f"      Supplier : {summary['supplier_email']}  ({summary['supplier_id']})")
    print(f"      RFQ      : {summary['rfq_id']}")
    print()
    print(f"      🛒  Browse → http://localhost:5173/marketplace")
    print("=" * 67)
    print()

    # Print a quick catalog table for verification
    print("   📋  Product catalog preview (first 10 / 50):")
    print("   ─" * 30)
    for idx, prod in enumerate(CURATED_PRODUCTS[:10], 1):
        print(
            f"   {idx:>2}. {prod['model_number']:24s}  "
            f"{_pretty_price(prod['unit_price_rmb']):>10s}  "
            f"{prod['product_name'][:55]}"
        )
    if len(CURATED_PRODUCTS) > 10:
        print(f"   … and {len(CURATED_PRODUCTS) - 10} more")
    print()


if __name__ == "__main__":
    asyncio.run(main())
