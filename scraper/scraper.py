#!/usr/bin/env python3
"""
MGNREGA NMMS Muster Roll Scraper
Scrapes daily attendance data from the MGNREGA portal and stores it via the Next.js API.
Photos are downloaded locally instead of storing external URLs (hotlinking blocked).

Usage:
    python3 scraper.py --date 2026-04-28 --api-url http://localhost:3000
    python3 scraper.py  # uses today's date
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# ─── Config ───────────────────────────────────────────────────────────────────
BASE_URL = "https://mnregaweb4.nic.in/netnrega"
LIST_URL = f"{BASE_URL}/View_NMMS_atten_date_dtl.aspx"

STATE_CODE = "34"
STATE_NAME = "JHARKHAND"
STATE_SHORT = "JH"
FIN_YEAR = "2025-2026"

BATCH_SIZE = 10          # MRs per API POST batch
REQUEST_DELAY = 1.5      # seconds between detail page requests
MAX_RETRIES = 3

# Photos are saved here and served by Next.js at /api/photos/<filename>
# In Docker this maps to /app/data/photos (shared volume)
PHOTOS_DIR = Path(os.environ.get("PHOTOS_DIR", "/app/data/photos"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def date_to_portal_fmt(iso_date: str) -> str:
    """Convert 2026-04-28 → 28/04/2026"""
    d = datetime.strptime(iso_date, "%Y-%m-%d")
    return d.strftime("%d/%m/%Y")


def build_list_url(date_iso: str) -> str:
    params = {
        "short_name": STATE_SHORT,
        "state_name": STATE_NAME,
        "state_code": STATE_CODE,
        "fin_year": FIN_YEAR,
        "AttendanceDate": date_to_portal_fmt(date_iso),
        "source": "",
    }
    return f"{LIST_URL}?{urlencode(params)}"


def extract_url_params(url: str) -> dict:
    """Parse query params from a URL into a dict."""
    parsed = urlparse(url)
    return {k: v[0] for k, v in parse_qs(parsed.query).items()}


def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return " ".join(text.strip().split())


# ─── Photo Download ────────────────────────────────────────────────────────────

def ensure_photos_dir():
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def download_photo(photo_url: str, filename: str) -> Optional[str]:
    """
    Download a photo from MGNREGA server and save locally.
    Returns the local API path (/api/photos/<filename>) or None on failure.
    The file is saved to PHOTOS_DIR/<filename>.
    """
    if not photo_url or not photo_url.startswith("http"):
        return None

    dest = PHOTOS_DIR / filename
    # Skip download if already cached
    if dest.exists() and dest.stat().st_size > 1000:
        log.debug(f"  Photo cached: {filename}")
        return f"/api/photos/{filename}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        "Referer": "https://mnregaweb4.nic.in/",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(photo_url, headers=headers, timeout=20, stream=True)
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "image" not in content_type and "jpeg" not in content_type:
                log.warning(f"  Unexpected content-type for photo: {content_type}")

            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)

            size_kb = dest.stat().st_size // 1024
            log.debug(f"  Downloaded photo: {filename} ({size_kb} KB)")
            return f"/api/photos/{filename}"

        except Exception as e:
            log.warning(f"  Photo download attempt {attempt} failed for {filename}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(1)

    log.error(f"  Failed to download photo: {photo_url}")
    return None


def make_photo_filename(msr_no: str, work_code: str, date_iso: str, suffix: str = "") -> str:
    """Generate a safe local filename for a photo."""
    safe_work = re.sub(r"[^a-zA-Z0-9]", "_", work_code)
    date_compact = date_iso.replace("-", "")
    return f"{msr_no}_{safe_work}_{date_compact}{suffix}.jpeg"


# ─── Step A: Scrape the main list page ────────────────────────────────────────

def scrape_mr_list(date_iso: str, page_html: str) -> list[dict]:
    """
    Parse the main MR list page HTML.
    Returns list of dicts with: district, block, panchayat, workCode, msrNo, detailUrl
    """
    soup = BeautifulSoup(page_html, "html.parser")
    rows = []

    table = soup.find("table", class_=lambda c: c and "table-bordered" in c)
    if not table:
        log.warning("Could not find main MR table")
        return rows

    tbody = table.find("tbody")
    if not tbody:
        return rows

    for tr in tbody.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 7:
            continue

        district = clean_text(tds[1].get_text())
        block = clean_text(tds[2].get_text())
        panchayat = clean_text(tds[3].get_text())
        work_code = clean_text(tds[4].get_text())

        # MR link is in tds[5]
        link_tag = tds[5].find("a")
        if not link_tag:
            continue

        msr_no = clean_text(link_tag.get_text())
        detail_url = link_tag.get("href", "")
        if detail_url and not detail_url.startswith("http"):
            detail_url = f"{BASE_URL}/{detail_url.lstrip('/')}"

        # Extract codes from URL params
        params = extract_url_params(detail_url)

        rows.append({
            "districtCode": params.get("district_code", ""),
            "districtName": district,
            "blockCode": params.get("block_code", ""),
            "blockName": block,
            "panchayatCode": params.get("panchayat_code", ""),
            "panchayatName": panchayat,
            "workCode": work_code,
            "msrNo": msr_no,
            "detailUrl": detail_url,
        })

    log.info(f"Found {len(rows)} MRs in list page")
    return rows


# ─── Step B+C: Scrape the detail (final) page ─────────────────────────────────

def scrape_mr_detail(date_iso: str, detail_html: str, mr_meta: dict) -> dict:
    """
    Parse the MR detail page HTML.
    Extracts: workName, photos (downloaded locally), workers list.
    """
    soup = BeautifulSoup(detail_html, "html.parser")
    result = {**mr_meta, "attendanceDate": date_iso}

    # ── Work name ──
    lbl_dtl = soup.find(id="ctl00_ContentPlaceHolder1_lbl_dtl")
    if lbl_dtl:
        text = lbl_dtl.get_text(" ", strip=True)
        m = re.search(r"Work Name\s*:\s*(.+?)(?:\s{2,}|$)", text, re.DOTALL)
        if m:
            result["workName"] = clean_text(m.group(1))

    def get_span_text(span_id: str) -> Optional[str]:
        el = soup.find(id=span_id)
        return clean_text(el.get_text()) if el else None

    def resolve_url(src: str) -> str:
        if not src:
            return ""
        if src.startswith("http"):
            return src
        if src.startswith("/"):
            return f"https://mnregaweb4.nic.in{src}"
        return src

    # ── Group Photo 1 — download locally ──
    img1 = soup.find(id="ctl00_ContentPlaceHolder1_img_groupPhoto")
    if img1:
        src1 = resolve_url(img1.get("src", ""))
        if src1:
            fname1 = make_photo_filename(mr_meta["msrNo"], mr_meta["workCode"], date_iso, "")
            local_path1 = download_photo(src1, fname1)
            result["photo1Url"] = local_path1  # e.g. /api/photos/300_xxx_20260428.jpeg
        else:
            result["photo1Url"] = None
    else:
        result["photo1Url"] = None

    result["photo1TakenAt"]     = get_span_text("ctl00_ContentPlaceHolder1_lbl_PhotoTakenTime")
    result["photo1UploadedAt"]  = get_span_text("ctl00_ContentPlaceHolder1_lbl_PhotoUploadTime")
    result["photo1Coords"]      = get_span_text("ctl00_ContentPlaceHolder1_lbl_cordinates")
    result["photo1TakenBy"]     = get_span_text("ctl00_ContentPlaceHolder1_lbl_Taken_by")
    result["photo1Designation"] = get_span_text("ctl00_ContentPlaceHolder1_lbl_Designation")

    # ── Group Photo 2 — download locally ──
    img2 = soup.find(id="ctl00_ContentPlaceHolder1_img_SecondGroupPhoto")
    if img2:
        src2 = resolve_url(img2.get("src", ""))
        if src2:
            fname2 = make_photo_filename(mr_meta["msrNo"], mr_meta["workCode"], date_iso, "_2nd")
            local_path2 = download_photo(src2, fname2)
            result["photo2Url"] = local_path2
        else:
            result["photo2Url"] = None
    else:
        result["photo2Url"] = None

    result["photo2TakenAt"]    = get_span_text("ctl00_ContentPlaceHolder1_lbl_SecondPhotoTakenTime")
    result["photo2UploadedAt"] = get_span_text("ctl00_ContentPlaceHolder1_lbl_SecondPhotoUploadTime")
    result["photo2Coords"]     = get_span_text("ctl00_ContentPlaceHolder1_lbl_SecondCordinates")

    # ── Workers ──
    workers = []
    grid = soup.find(id="ctl00_ContentPlaceHolder1_Gridviewattandance")
    if grid:
        for tr in grid.find_all("tr")[1:]:  # skip header
            tds = tr.find_all("td")
            if len(tds) < 5:
                continue

            sno_text = clean_text(tds[0].get_text())
            job_card = clean_text(tds[1].get_text())
            worker_raw = clean_text(tds[2].get_text())
            present_text = clean_text(tds[4].get_text()).lower()

            gender = None
            gm = re.search(r"\(([MF])\)", worker_raw, re.IGNORECASE)
            if gm:
                gender = gm.group(1).upper()
                worker_name = re.sub(r"\s*\([MF]\)\s*$", "", worker_raw, flags=re.IGNORECASE).strip()
            else:
                worker_name = worker_raw

            try:
                sno = int(sno_text)
            except ValueError:
                sno = len(workers) + 1

            workers.append({
                "sno": sno,
                "jobCardNo": job_card,
                "workerName": worker_name,
                "gender": gender,
                "isPresent": "present" in present_text,
            })

    result["workers"] = workers
    log.debug(f"  MR {mr_meta['msrNo']}: {len(workers)} workers")
    return result


# ─── Playwright fetch ──────────────────────────────────────────────────────────

def fetch_with_playwright(url: str, retries: int = MAX_RETRIES) -> Optional[str]:
    for attempt in range(1, retries + 1):
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                ctx = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
                    viewport={"width": 1280, "height": 800},
                )
                page = ctx.new_page()
                page.goto(url, wait_until="networkidle", timeout=30000)
                html = page.content()
                browser.close()
                return html
        except PlaywrightTimeout:
            log.warning(f"Timeout on attempt {attempt} for {url}")
            if attempt < retries:
                time.sleep(2 ** attempt)
        except Exception as e:
            log.error(f"Playwright error on attempt {attempt}: {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    return None


def fetch_with_requests(url: str, retries: int = MAX_RETRIES) -> Optional[str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=20)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            log.warning(f"requests error attempt {attempt}: {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    return None


# ─── API push ─────────────────────────────────────────────────────────────────

def push_to_api(api_url: str, batch: list[dict]) -> bool:
    endpoint = f"{api_url.rstrip('/')}/api/muster-rolls"
    try:
        resp = requests.post(
            endpoint,
            json={"musterRolls": batch},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        log.info(f"  API: upserted {data.get('upserted', '?')} records")
        return True
    except Exception as e:
        log.error(f"API push failed: {e}")
        return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="MGNREGA MR Scraper")
    parser.add_argument("--date", default=datetime.today().strftime("%Y-%m-%d"),
                        help="Date to scrape (YYYY-MM-DD), default: today")
    parser.add_argument("--api-url", default="http://localhost:3000",
                        help="Base URL of the Next.js API")
    parser.add_argument("--use-playwright", action="store_true",
                        help="Force Playwright (slower but handles JS)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Scrape but don't push to API")
    args = parser.parse_args()

    date_iso = args.date
    log.info(f"Starting scrape for date: {date_iso}")
    log.info(f"API URL: {args.api_url}")
    log.info(f"Photos dir: {PHOTOS_DIR}")

    ensure_photos_dir()

    # ── Step A: Fetch list page ──
    list_url = build_list_url(date_iso)
    log.info(f"Fetching list page: {list_url}")

    if args.use_playwright:
        list_html = fetch_with_playwright(list_url)
    else:
        list_html = fetch_with_requests(list_url)
        if not list_html:
            log.info("requests failed, falling back to Playwright")
            list_html = fetch_with_playwright(list_url)

    if not list_html:
        log.error("Failed to fetch list page. Exiting.")
        sys.exit(1)

    mr_list = scrape_mr_list(date_iso, list_html)
    if not mr_list:
        log.warning("No MRs found. The portal may have no data for this date.")
        sys.exit(0)

    log.info(f"Processing {len(mr_list)} MRs...")

    # ── Steps B+C: Fetch each detail page + download photos ──
    batch = []
    total_processed = 0
    total_failed = 0

    for i, mr_meta in enumerate(mr_list, 1):
        log.info(f"[{i}/{len(mr_list)}] MR {mr_meta['msrNo']} – {mr_meta['panchayatName']}")

        detail_html = fetch_with_requests(mr_meta["detailUrl"])
        if not detail_html:
            detail_html = fetch_with_playwright(mr_meta["detailUrl"])

        if not detail_html:
            log.warning(f"  Skipping MR {mr_meta['msrNo']} – could not fetch detail page")
            total_failed += 1
            continue

        mr_data = scrape_mr_detail(date_iso, detail_html, mr_meta)
        batch.append(mr_data)
        total_processed += 1

        if len(batch) >= BATCH_SIZE:
            if not args.dry_run:
                push_to_api(args.api_url, batch)
            else:
                log.info(f"  [dry-run] Would push {len(batch)} records")
            batch = []

        time.sleep(REQUEST_DELAY)

    if batch:
        if not args.dry_run:
            push_to_api(args.api_url, batch)
        else:
            log.info(f"  [dry-run] Would push {len(batch)} records")

    log.info(f"Done. Processed: {total_processed}, Failed: {total_failed}")


if __name__ == "__main__":
    main()
