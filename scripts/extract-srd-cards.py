from __future__ import annotations

import argparse
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import fitz
from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "public" / "cards" / "srd"
SUPPORTED_FORMATS = {"original", "png", "jpeg", "webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract each embedded SRD card image from the printer-friendly PDF.",
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Path to the source PDF.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for the exported cards. Defaults to {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument(
        "--format",
        choices=sorted(SUPPORTED_FORMATS),
        default="webp",
        help="Image format for exported cards. 'original' keeps the embedded file format.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=92,
        help="Quality for lossy output formats.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove previously generated card files in the output directory before exporting.",
    )
    return parser.parse_args()


def cluster_positions(values: list[float], tolerance: float = 1.0) -> list[float]:
    clusters: list[float] = []
    for value in sorted(values):
        if not clusters or abs(value - clusters[-1]) > tolerance:
            clusters.append(value)
    return clusters


def nearest_index(value: float, positions: list[float]) -> int:
    return min(range(len(positions)), key=lambda idx: abs(value - positions[idx]))


def clean_output_dir(output_dir: Path) -> None:
    for pattern in ("*.png", "*.jpg", "*.jpeg", "*.webp", "manifest.json"):
        for path in output_dir.glob(pattern):
            path.unlink()


def save_image(raw_bytes: bytes, source_ext: str, output_path: Path, output_format: str, quality: int) -> tuple[int, int]:
    if output_format == "original":
        output_path.write_bytes(raw_bytes)
        with Image.open(io.BytesIO(raw_bytes)) as image:
            return image.width, image.height

    with Image.open(io.BytesIO(raw_bytes)) as image:
        if output_format == "jpeg" and image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        save_kwargs: dict[str, int | bool] = {}
        if output_format == "webp":
            save_kwargs = {"quality": quality, "method": 6}
        elif output_format == "jpeg":
            save_kwargs = {"quality": quality, "optimize": True}

        image.save(output_path, format=output_format.upper(), **save_kwargs)
        return image.width, image.height


def build_filename(sequence: int, page_number: int, row_number: int, column_number: int, ext: str) -> str:
    return f"srd-card-{sequence:03d}-p{page_number:02d}-r{row_number}-c{column_number}.{ext}"


def main() -> None:
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()

    if not input_path.exists():
        raise SystemExit(f"Source PDF not found: {input_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    if args.clean:
        clean_output_dir(output_dir)

    document = fitz.open(input_path)
    extracted_cache: dict[int, tuple[bytes, str]] = {}
    cards: list[dict[str, object]] = []
    sequence = 1

    for page_index in range(document.page_count):
        page = document.load_page(page_index)
        placements: list[tuple[int, fitz.Rect]] = []

        for image_info in page.get_images(full=True):
            xref = image_info[0]
            for rect in page.get_image_rects(xref, transform=False):
                placements.append((xref, rect))

        if not placements:
            continue

        placements.sort(key=lambda item: (round(item[1].y0, 3), round(item[1].x0, 3)))
        x_positions = cluster_positions([rect.x0 for _, rect in placements])
        y_positions = cluster_positions([rect.y0 for _, rect in placements])
        page_label = " ".join(page.get_text("text").split())

        for xref, rect in placements:
            if xref not in extracted_cache:
                extracted = document.extract_image(xref)
                extracted_cache[xref] = (extracted["image"], extracted["ext"].lower())

            raw_bytes, source_ext = extracted_cache[xref]
            row_number = nearest_index(rect.y0, y_positions) + 1
            column_number = nearest_index(rect.x0, x_positions) + 1
            output_ext = source_ext if args.format == "original" else ("jpg" if args.format == "jpeg" else args.format)
            filename = build_filename(sequence, page_index + 1, row_number, column_number, output_ext)
            output_path = output_dir / filename
            width, height = save_image(raw_bytes, source_ext, output_path, args.format, args.quality)

            cards.append(
                {
                    "id": f"srd-card-{sequence:03d}",
                    "sequence": sequence,
                    "page": page_index + 1,
                    "pageLabel": page_label,
                    "row": row_number,
                    "column": column_number,
                    "filename": filename,
                    "publicPath": f"/cards/srd/{filename}",
                    "format": output_ext,
                    "width": width,
                    "height": height,
                    "sourceRect": {
                        "x0": round(rect.x0, 3),
                        "y0": round(rect.y0, 3),
                        "x1": round(rect.x1, 3),
                        "y1": round(rect.y1, 3),
                    },
                }
            )
            sequence += 1

    manifest = {
        "sourcePdf": str(input_path),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "outputFormat": args.format,
        "pageCount": document.page_count,
        "totalCards": len(cards),
        "cards": cards,
    }

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Exported {len(cards)} cards to {output_dir}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
