"""Convert 杀戮尖塔全卡.xlsx into a normalized cards.json for the static site."""
from pathlib import Path
import json
import re

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT.parent / "杀戮尖塔全卡.xlsx"
OUT = ROOT / "data" / "cards.json"


def split_multi(value):
    if value is None:
        return []
    text = str(value).strip()
    if not text or text == "无":
        return ["无"]
    # Chinese comma, comma, slash, and spaces are all treated as separators.
    parts = [p for p in re.split(r"[,，/、\s]+", text) if p]
    return parts or ["无"]


def split_special(value):
    if value is None:
        return []
    text = str(value).strip()
    if not text or text == "无":
        return ["无"]
    # User requirement: split the special explanation by comma into terms.
    parts = [p for p in re.split(r"[,，]+", text) if p]
    return parts or ["无"]


def clean_text(value):
    return "" if value is None else str(value).strip()


def build_card(index, row):
    name = clean_text(row[0])
    owner_raw = clean_text(row[1])
    cost = clean_text(row[2])
    card_type = clean_text(row[3])
    rarity_raw = clean_text(row[4])
    keywords = split_multi(row[5])
    statuses = split_multi(row[6])
    version = split_multi(row[7])
    special = split_special(row[8])

    owners = split_multi(owner_raw)
    rarities = split_multi(rarity_raw)

    search_terms = [name, owner_raw, card_type, rarity_raw]
    search_terms += [t for t in keywords if t != "无"]
    search_terms += [t for t in statuses if t != "无"]
    search_terms += [t for t in version if t != "无"]
    search_terms += [t for t in special if t != "无"]

    return {
        "id": f"card_{index:04d}",
        "name": name,
        "displayName": name,
        "owner": owner_raw,
        "owners": owners,
        "cost": cost,
        "type": card_type,
        "rarity": rarity_raw,
        "rarities": rarities,
        "keywords": keywords,
        "statuses": statuses,
        "gameVersion": version,
        "special": special,
        "tags": list(dict.fromkeys(search_terms)),
    }


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Sheet1"]
    cards = []
    for index, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=1):
        if not row or not row[0]:
            continue
        card = build_card(index, row)
        cards.append(card)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    print(f"generated {len(cards)} cards -> {OUT}")


if __name__ == "__main__":
    main()
