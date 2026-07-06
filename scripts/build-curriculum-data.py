#!/usr/bin/env python3
"""Build curriculum-data.js from the Anjwa High School curriculum workbook.

Usage:
  python3 scripts/build-curriculum-data.py \
    "../안좌고_2026학년도 전(全)학년 교육과정 편성표(보통과)(개설교과).xlsx"
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "curriculum-data.js"
NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
SEMESTERS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"]
PLAN_META = {
    "교육과정편성표(2026학년도 전학년 보통과)": (
        "current2026",
        "현학년도 전학년",
        "2026학년도 현재 1·2·3학년 개설 및 개설 예정 과목",
    ),
    "2026학년도 신입생": ("incoming2026", "2026학년도 신입생", "2026학년도 입학생 3개년 교육과정"),
    "2025학년도 신입생": ("incoming2025", "2025학년도 신입생", "2025학년도 입학생 3개년 교육과정"),
    "2024학년도 신입생": ("incoming2024", "2024학년도 신입생", "2024학년도 입학생 3개년 교육과정"),
}


def colnum(letters: str) -> int:
    number = 0
    for char in letters:
        number = number * 26 + ord(char) - 64
    return number


def split_ref(ref: str) -> tuple[int, int]:
    match = re.match(r"([A-Z]+)(\d+)", ref)
    if not match:
        raise ValueError(f"Invalid cell reference: {ref}")
    return int(match.group(2)), colnum(match.group(1))


def range_cells(ref: str):
    start, end = ref.split(":")
    row1, col1 = split_ref(start)
    row2, col2 = split_ref(end)
    for row in range(row1, row2 + 1):
        for col in range(col1, col2 + 1):
            yield row, col


def clean_text(value: str) -> str:
    return value.replace("_x000D_", "").replace("\n", " / ").strip()


def section_text(value: str) -> str:
    return " ".join(value.replace("/", " ").split())


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    chars = []
    for char in normalized:
        if char.isalnum():
            chars.append(char.lower())
        elif char in ["·", "∙", "Ⅰ", "Ⅱ", "Ⅲ"]:
            chars.append(char)
        else:
            chars.append("_")
    return re.sub(r"_+", "_", "".join(chars)).strip("_") or "course"


def cell_text(cell: ET.Element, shared_strings: list[str]) -> str:
    inline = cell.find("a:is", NS)
    value = cell.find("a:v", NS)
    if inline is not None:
        return clean_text("".join((text.text or "") for text in inline.iter(f"{{{NS['a']}}}t")))
    if value is None:
        return ""
    output = value.text or ""
    if cell.attrib.get("t") == "s" and output.isdigit():
        output = shared_strings[int(output)]
    return clean_text(output)


def read_workbook(path: Path) -> dict:
    plans = {}
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_xml = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_xml.findall("a:si", NS):
                shared_strings.append("".join((text.text or "") for text in item.iter(f"{{{NS['a']}}}t")))

        for sheet in workbook.findall("a:sheets/a:sheet", NS):
            sheet_name = sheet.attrib["name"]
            if sheet_name not in PLAN_META:
                continue
            key, label, description = PLAN_META[sheet_name]
            rel_id = sheet.attrib[f"{{{NS['r']}}}id"]
            target = relmap[rel_id]
            sheet_path = "xl/" + target.lstrip("/") if not target.startswith("xl/") else target
            sheet_xml = ET.fromstring(archive.read(sheet_path))
            grid = build_grid(sheet_xml, shared_strings)
            plans[key] = parse_sheet(sheet_name, label, description, grid)
    return plans


def build_grid(sheet_xml: ET.Element, shared_strings: list[str]) -> dict[tuple[int, int], str]:
    grid = {}
    for row in sheet_xml.findall("a:sheetData/a:row", NS):
        for cell in row.findall("a:c", NS):
            row_num, col_num = split_ref(cell.attrib.get("r", ""))
            text = cell_text(cell, shared_strings)
            if text:
                grid[(row_num, col_num)] = text

    merges = sheet_xml.find("a:mergeCells", NS)
    if merges is not None:
        for merge in merges.findall("a:mergeCell", NS):
            ref = merge.attrib["ref"]
            row_num, col_num = split_ref(ref.split(":")[0])
            top_left = grid.get((row_num, col_num), "")
            if top_left:
                for merged_row, merged_col in range_cells(ref):
                    grid.setdefault((merged_row, merged_col), top_left)
    return grid


def parse_sheet(sheet_name: str, label: str, description: str, grid: dict[tuple[int, int], str]) -> dict:
    cols = (
        {"section": 1, "area": 3, "type": 4, "subject": 5, "base": 6, "credit": 7, "start": 8}
        if sheet_name.startswith("2024")
        else {"section": 1, "area": 2, "type": 3, "subject": 4, "base": 5, "credit": 6, "start": 7}
    )
    semester_cols = [cols["start"] + index for index in range(6)]
    courses = []
    summary = {semester: {} for semester in SEMESTERS}
    current_section = ""

    for row in range(5, 120):
        section_cell = grid.get((row, cols["section"]), "")
        if section_cell:
            current_section = section_cell
        subject = grid.get((row, cols["subject"]), "")
        if not subject or should_skip_row(section_cell, current_section, subject):
            continue
        semesters = []
        markers = {}
        for index, col in enumerate(semester_cols):
            marker = grid.get((row, col), "")
            if marker:
                semesters.append(SEMESTERS[index])
                markers[SEMESTERS[index]] = marker
        if not semesters:
            continue
        credit_text = grid.get((row, cols["credit"]), "")
        try:
            credits = int(float(credit_text))
        except ValueError:
            credits = 0
        courses.append(
            {
                "id": f"{slug(sheet_name)}_{row}_{slug(subject)}",
                "section": section_text(current_section),
                "area": section_text(grid.get((row, cols["area"]), "")),
                "category": section_text(grid.get((row, cols["type"]), "")),
                "name": subject.replace("∙", "·"),
                "baseCredits": grid.get((row, cols["base"]), ""),
                "credits": credits,
                "semesters": semesters,
                "markers": markers,
                "row": row,
            }
        )

    summary_labels = {
        "이수학점 소계": "courseCredits",
        "창의적 체험활동": "creativeCredits",
        "학기별 총 이수학점": "totalCredits",
        "학기별 총 이수 학점": "totalCredits",
        "학기당 과목수": "courseCount",
    }
    for row in range(5, 120):
        row_name = grid.get((row, cols["section"]), "") or grid.get((row, cols["subject"]), "")
        if row_name in summary_labels:
            prop = summary_labels[row_name]
            for index, col in enumerate(semester_cols):
                value = grid.get((row, col), "")
                if value:
                    summary[SEMESTERS[index]][prop] = value

    return {"label": label, "description": description, "sheetName": sheet_name, "courses": courses, "summary": summary}


def should_skip_row(section_cell: str, section: str, subject: str) -> bool:
    fixed_labels = ["이수학점 소계", "창의적 체험활동", "학기별 총 이수학점", "학기별 총 이수 학점", "학기당 과목수", "학년별 총 이수 학점"]
    if section_cell in fixed_labels:
        return True
    haystack = f"{section} {subject}"
    return any(word in haystack for word in ["소계", "이수학점", "창의적", "학기별", "학년별"])


def main() -> int:
    if len(sys.argv) > 1:
        source = Path(sys.argv[1]).expanduser().resolve()
    else:
        candidates = [
            path
            for path in ROOT.parent.glob("*.xlsx")
            if all(token in unicodedata.normalize("NFC", path.name) for token in ["안좌고", "교육과정", "편성표"])
        ]
        if not candidates:
            print("안좌고 교육과정 엑셀 파일을 찾지 못했습니다. 파일 경로를 인자로 넣어 주세요.", file=sys.stderr)
            return 1
        source = candidates[0]
    data = {"source": source.name, "updated": "2026-07-03", "plans": read_workbook(source)}
    OUTPUT.write_text("window.ANJWA_CURRICULUM_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"updated: {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
