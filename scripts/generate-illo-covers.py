#!/usr/bin/env python3
"""Generate blog post cover images with illo (Blip mascot, brand palette).

Replaces the old Replicate/SDXL pipeline. Discovers posts under content/posts/,
skips slugs that already have static/images/covers/{slug}.png (unless forced),
builds a Blip editorial prompt, renders via scripts/vendor/illo.py, and saves
exactly 1200×630 PNG.

Backends
  - CI: OpenRouter (seed ~/.config/illo/config.yaml from OPENROUTER_API_KEY)
  - Local: Grok CLI if logged in, else OpenRouter if key present

Env
  FORCE_REGENERATE_COVERS=1|true   regenerate even when PNG exists
  MAX_ILLO_COVERS=N                cap how many to generate this run (default 999)
  ILLO_BACKEND=openrouter|grok|codex
  ILLO_MODEL=...                   OpenRouter model id only
  ILLO_CHARACTER=blip              character pack name (must be installed)
  OPENROUTER_API_KEY=...           written into illo config for CI (never logged)
  ILLO_PY=path                     override path to illo.py
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
OUT_DIR = ROOT / "static" / "images" / "covers"
DEFAULT_ILLO = ROOT / "scripts" / "vendor" / "illo.py"

BRAND_PAPER = "#f6f7f4"
BRAND_INK = "#1a1414"
BRAND_ACCENT = "#d64a48"
WIDTH, HEIGHT = 1200, 630

CHARACTER_SPECS = {
    "blip": {
        "style": "riso",
        "ref_name": "reference.png",
        "prompt": (
            "the recurring mascot — a rounded-cube body, one rounded-rectangle "
            "screen face with two dot eyes, blank deadpan (no eyebrows, no mouth), "
            "one short antenna with an accent-colored ball tip, stubby arms and legs. "
            "It MUST perform the move, not decorate. Light/cream body with structure-ink "
            "outline; the screen is structure ink (charcoal, not pure black); white/cream "
            "dot eyes. The antenna ball tip uses THIS palette's accent "
            f"{BRAND_ACCENT}, even if the reference sheet shows a different hue. "
            "Never add panels, seams, bolts, rivets, vents, gauges, screen UI/pixels/"
            "text/expressions, multiple antennae, ears, hats, clothing, shiny eyes, "
            "eyebrows, or mouth."
        ),
        "line_language": (
            "draw EVERYTHING — mascot, objects, arrows — in ONE bold, even-weight, "
            "softly-rounded outline (clean vinyl-sticker line), not thin scratchy sketch lines."
        ),
        "style_block": (
            "risograph print — grainy halftone texture, slight ink-layer offset, "
            "faint paper grain, flat fills, no gradients, no soft shadows."
        ),
        "palette_block": (
            f"paper {BRAND_PAPER}. Structure ink {BRAND_INK} for all linework, forms, "
            f"and text. Accent {BRAND_ACCENT} used sparingly — the character's antenna "
            "ball tip + 1–2 elements."
        ),
        "accent_part": "antenna ball tip",
    },
}


def env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def strip_md(s: str) -> str:
    s = re.sub(r"`{3}[\s\S]*?`{3}", "", s)
    s = re.sub(r"`[^`]*`", "", s)
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"^#+\s+", "", s, flags=re.M)
    s = re.sub(r"[*_~>#\-]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_post(path: Path) -> dict:
    slug = path.stem
    src = path.read_text(encoding="utf-8")
    parts = src.split("+++")
    tags: list[str] = []
    title = slug.replace("-", " ")
    desc = ""
    if len(parts) > 1:
        header = parts[1]
        m1 = re.search(r"\[taxonomies\][\s\S]*?tags\s*=\s*\[(.*?)\]", header)
        m2 = re.search(r"\ntags\s*=\s*\[(.*?)\]", header)
        raw = (m1.group(1) if m1 else "") or (m2.group(1) if m2 else "")
        tags = [
            t.strip().strip("\"'")
            for t in raw.split(",")
            if t.strip().strip("\"'")
        ][:6]
        t = re.search(r'\ntitle\s*=\s*"((?:\\.|[^"\\])*)"', header)
        if t:
            title = t.group(1).replace('\\"', '"')
        d = re.search(r'\ndescription\s*=\s*"((?:\\.|[^"\\])*)"', header)
        if d:
            desc = d.group(1).replace('\\"', '"')
    if not desc and len(parts) > 2:
        body = "+++".join(parts[2:])
        desc = strip_md(body)[:240]
    return {"slug": slug, "title": title, "desc": desc, "tags": tags}


def discover_posts() -> list[dict]:
    files = sorted(
        p for p in POSTS_DIR.glob("*.md") if p.name != "_index.md"
    )
    return [parse_post(p) for p in files]


def character_home(name: str) -> Path:
    xdg = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(xdg) / "illo" / "characters" / name


def resolve_ref(character: str) -> Path:
    home = character_home(character)
    for candidate in ("reference.png", "reference.webp", "reference.jpg"):
        p = home / candidate
        if p.is_file():
            return p
    raise SystemExit(
        f"Character pack '{character}' not installed or missing reference image "
        f"at {home}. Run: scripts/illo-bootstrap.sh"
    )


def build_prompt(post: dict, character: str) -> str:
    spec = CHARACTER_SPECS.get(character)
    if not spec:
        raise SystemExit(
            f"No prompt template for character '{character}'. "
            f"Known: {', '.join(CHARACTER_SPECS)}"
        )
    tags = ", ".join(post["tags"]) or "software engineering"
    context = (post["desc"] or post["title"]).replace('"', "'")[:220]
    idea = (
        f"{post['title']} — {context}"
        if post["desc"]
        else post["title"]
    )
    composition = (
        f"scene: Blip performs the idea of the post, using one or two simple "
        f"physical props that embody the topic ({tags}). The mascot is large, "
        f"centered, and clearly doing the work — never a side decoration. "
        f"Keep props readable at thumbnail size."
    )
    # Character name in composition is blip-specific wording; generalize lightly
    if character != "blip":
        composition = composition.replace("Blip", character.capitalize())

    return f"""A 16:9 horizontal editorial illustration that explains ONE idea: "{idea}".

Composition ({composition.split(':', 1)[0]}): {composition.split(':', 1)[1].strip()} Generous negative space (keep ~35%+ of the canvas empty); the subject is large and confident, ~50–70% of the frame.

CHARACTER (locked, keep exactly on the reference model): {spec['prompt']} The mascot is a solid OPAQUE shape in front of the scene — no ground line, table edge, horizon, or prop passes through its body; background lines stop at its silhouette. Its limbs join the body cleanly at sensible points. Only the mascot's own parts touch its outline: any tool is HELD in a hand and clearly separated from the torso. Hold at most one prop per hand. Preserve stubby limb proportions — never stretch arms across the whole scene.

LINE LANGUAGE: {spec['line_language']}

STYLE: {spec['style_block']}

PALETTE: {spec['palette_block']}

TEXT: no hand-lettered text anywhere — no labels, title, caption, logo, signature, numbers, or stray words.
"""


def seed_openrouter_config(api_key: str, model: str, character: str) -> None:
    """CI/cloud: write illo config from a provisioned secret (never log the key)."""
    cfg_dir = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "illo"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    cfg = cfg_dir / "config.yaml"
    body = (
        "configVersion: 2\n"
        f"apiKey: {api_key}\n"
        "backend: openrouter\n"
        f"model: {model}\n"
        f"defaultCharacter: {character}\n"
        'aspect: "16:9"\n'
    )
    cfg.write_text(body, encoding="utf-8")
    cfg.chmod(0o600)
    print(f"Seeded illo config at {cfg} (backend=openrouter, character={character})")


def resolve_backend() -> str:
    explicit = os.environ.get("ILLO_BACKEND", "").strip()
    if explicit:
        return explicit
    if os.environ.get("OPENROUTER_API_KEY"):
        return "openrouter"
    # Prefer Grok when available (local Grok agent / CLI)
    if shutil.which("grok"):
        return "grok"
    return "openrouter"


def run_illo_generate(
    illo_py: Path,
    prompt_file: Path,
    ref: Path,
    out_path: Path,
    backend: str,
    model: str | None,
    label: str,
) -> Path:
    cmd = [
        sys.executable,
        str(illo_py),
        "generate",
        "--prompt-file",
        str(prompt_file),
        "--ref",
        str(ref),
        "--aspect",
        "16:9",
        "--backend",
        backend,
        "--label",
        label,
        "--out",
        str(out_path),
    ]
    if model and backend == "openrouter":
        cmd.extend(["--model", model])

    print(f"  illo generate ({backend}) → {label}")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    # illo prints notes to stderr and JSON to stdout; both may mix
    combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
    if proc.returncode != 0:
        print(combined[-2000:], file=sys.stderr)
        raise RuntimeError(f"illo generate failed for {label} (exit {proc.returncode})")

    actual: Path | None = None
    for line in reversed(combined.splitlines()):
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        p = data.get("path")
        if p and Path(p).is_file():
            actual = Path(p)
            break

    if actual is None:
        # Fallback: out path with any image extension
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            cand = out_path.with_suffix(ext)
            if cand.is_file():
                actual = cand
                break
    if actual is None or not actual.is_file():
        raise RuntimeError(f"illo produced no image file for {label}")
    return actual


def resize_cover(src: Path, dest: Path) -> None:
    """Resize to exactly 1200×630 cover-fit PNG."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Prefer magick/convert, then sips (macOS), then Pillow
    if shutil.which("magick"):
        subprocess.run(
            [
                "magick",
                str(src),
                "-resize",
                f"{WIDTH}x{HEIGHT}^",
                "-gravity",
                "center",
                "-extent",
                f"{WIDTH}x{HEIGHT}",
                str(dest),
            ],
            check=True,
        )
        return
    if shutil.which("convert"):
        subprocess.run(
            [
                "convert",
                str(src),
                "-resize",
                f"{WIDTH}x{HEIGHT}^",
                "-gravity",
                "center",
                "-extent",
                f"{WIDTH}x{HEIGHT}",
                str(dest),
            ],
            check=True,
        )
        return
    try:
        from PIL import Image  # type: ignore
    except ImportError as e:
        raise SystemExit(
            "Need ImageMagick (`magick`/`convert`) or Pillow to resize covers"
        ) from e
    im = Image.open(src).convert("RGB")
    # cover fit
    scale = max(WIDTH / im.width, HEIGHT / im.height)
    nw, nh = int(im.width * scale + 0.5), int(im.height * scale + 0.5)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - WIDTH) // 2
    top = (nh - HEIGHT) // 2
    im = im.crop((left, top, left + WIDTH, top + HEIGHT))
    im.save(dest, format="PNG", optimize=True)


def generate_one(
    post: dict,
    *,
    illo_py: Path,
    ref: Path,
    character: str,
    backend: str,
    model: str | None,
    work: Path,
) -> bool:
    force = env_truthy("FORCE_REGENERATE_COVERS")
    dest = OUT_DIR / f"{post['slug']}.png"
    if dest.is_file() and not force:
        return False

    prompt = build_prompt(post, character)
    prompt_file = work / f"{post['slug']}.txt"
    prompt_file.write_text(prompt, encoding="utf-8")
    raw_out = work / f"{post['slug']}-raw.png"

    try:
        actual = run_illo_generate(
            illo_py, prompt_file, ref, raw_out, backend, model, post["slug"]
        )
        resize_cover(actual, dest)
        print(f"  saved: {dest.relative_to(ROOT)}")
        return True
    except Exception as e:
        print(f"  FAILED {post['slug']}: {e}", file=sys.stderr)
        return False


def main() -> int:
    character = os.environ.get("ILLO_CHARACTER", "blip").strip() or "blip"
    model = os.environ.get(
        "ILLO_MODEL", "x-ai/grok-imagine-image-quality"
    ).strip()
    illo_py = Path(os.environ.get("ILLO_PY") or DEFAULT_ILLO)
    if not illo_py.is_file():
        raise SystemExit(f"illo.py not found at {illo_py}. Run scripts/illo-bootstrap.sh")

    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if api_key:
        seed_openrouter_config(api_key, model, character)

    backend = resolve_backend()
    if backend == "openrouter" and not api_key:
        # Config may already have a key from local `illo.py init`
        cfg = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "illo" / "config.yaml"
        if not cfg.is_file():
            print(
                "OPENROUTER_API_KEY not set and no ~/.config/illo/config.yaml — "
                "skipping cover generation",
                file=sys.stderr,
            )
            return 0

    ref = resolve_ref(character)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    posts = discover_posts()
    max_n = int(os.environ.get("MAX_ILLO_COVERS") or "999")

    print(
        f"illo covers: character={character} backend={backend} "
        f"posts={len(posts)} force={env_truthy('FORCE_REGENERATE_COVERS')}"
    )

    created = 0
    with tempfile.TemporaryDirectory(prefix="illo-covers-") as tmp:
        work = Path(tmp)
        for post in posts:
            if created >= max_n:
                break
            if generate_one(
                post,
                illo_py=illo_py,
                ref=ref,
                character=character,
                backend=backend,
                model=model if backend == "openrouter" else None,
                work=work,
            ):
                created += 1

    print(f"illo cover generation completed: {created} cover(s) created")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
