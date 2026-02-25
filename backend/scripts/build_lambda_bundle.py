"""Build and cache local Lambda bundles for CDK asset staging."""

from __future__ import annotations

import argparse
import hashlib
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys

logger = logging.getLogger(__name__)

PIP_VERSION = "25.3"
TARGET_PLATFORM = "manylinux_2_17_aarch64"
TARGET_IMPLEMENTATION = "cp"
TARGET_PYTHON_VERSION = "3.12"
CACHE_FORMAT_VERSION = "1"


def _ensure_python_version() -> None:
    if sys.version_info[:2] != (3, 12):
        raise SystemExit("Python 3.12 is required to build Lambda bundles.")


def _run_pip(command: list[str], cwd: Path, env: dict[str, str]) -> None:
    subprocess.run(command, check=True, cwd=cwd, env=env)


def _copy_tree(source: Path, destination: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(f"Missing source path: {source}")
    shutil.copytree(source, destination, dirs_exist_ok=True)


def _remove_tree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)


def _cleanup_bundle(output_dir: Path) -> None:
    for cache_dir in output_dir.rglob("__pycache__"):
        shutil.rmtree(cache_dir)
    for cache_file in output_dir.rglob("*.pyc"):
        cache_file.unlink()
    for cache_file in output_dir.rglob("*.pyo"):
        cache_file.unlink()


def _dependency_cache_key(requirements: Path) -> str:
    hasher = hashlib.sha256()
    hasher.update(requirements.read_bytes())
    hasher.update(CACHE_FORMAT_VERSION.encode("utf-8"))
    hasher.update(PIP_VERSION.encode("utf-8"))
    hasher.update(TARGET_PLATFORM.encode("utf-8"))
    hasher.update(TARGET_IMPLEMENTATION.encode("utf-8"))
    hasher.update(TARGET_PYTHON_VERSION.encode("utf-8"))
    return hasher.hexdigest()


def _pip_env(build_root: Path) -> dict[str, str]:
    home_dir = build_root / "home"
    pip_cache_dir = build_root / "pip-cache"
    python_user_base = build_root / "python-user-base"
    home_dir.mkdir(parents=True, exist_ok=True)
    pip_cache_dir.mkdir(parents=True, exist_ok=True)
    python_user_base.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env.update(
        {
            "HOME": str(home_dir),
            "PIP_CACHE_DIR": str(pip_cache_dir),
            "PYTHONUSERBASE": str(python_user_base),
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONHASHSEED": "0",
        }
    )
    return env


def _build_dependency_cache(
    source_root: Path,
    requirements: Path,
    cache_dir: Path,
    env: dict[str, str],
) -> None:
    cache_root = cache_dir.parent
    cache_root.mkdir(parents=True, exist_ok=True)
    temp_cache_dir = cache_root / f".{cache_dir.name}.tmp"
    _remove_tree(temp_cache_dir)
    temp_cache_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Installing Lambda Python dependencies into cache...")
    _run_pip(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--upgrade",
            f"pip=={PIP_VERSION}",
            "--no-warn-script-location",
        ],
        cwd=source_root,
        env=env,
    )
    _run_pip(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "-r",
            str(requirements),
            "-t",
            str(temp_cache_dir),
            "--no-compile",
            "--platform",
            TARGET_PLATFORM,
            "--only-binary=:all:",
            "--implementation",
            TARGET_IMPLEMENTATION,
            "--python-version",
            TARGET_PYTHON_VERSION,
        ],
        cwd=source_root,
        env=env,
    )
    _cleanup_bundle(temp_cache_dir)
    _remove_tree(cache_dir)
    temp_cache_dir.rename(cache_dir)


def _prune_old_dependency_caches(cache_root: Path, active_cache: Path) -> None:
    for candidate in cache_root.iterdir():
        if candidate == active_cache:
            continue
        if candidate.is_dir():
            shutil.rmtree(candidate)


def _ensure_dependency_cache(source_root: Path, requirements: Path) -> Path:
    if not requirements.is_file():
        raise FileNotFoundError(f"Missing requirements file: {requirements}")

    build_root = source_root / ".lambda-build"
    cache_root = build_root / "deps-cache"
    key = _dependency_cache_key(requirements)
    cache_dir = cache_root / key
    marker_file = cache_dir / ".ready"
    env = _pip_env(build_root)
    cache_root.mkdir(parents=True, exist_ok=True)

    if marker_file.is_file():
        logger.info("Reusing cached Lambda dependencies: %s", key[:12])
        _prune_old_dependency_caches(cache_root, cache_dir)
        return cache_dir

    logger.info("No dependency cache found for requirements hash %s", key[:12])
    _build_dependency_cache(source_root, requirements, cache_dir, env)
    marker_file.write_text(f"{key}\n", encoding="utf-8")
    logger.info("Lambda dependency cache ready: %s", key[:12])
    _prune_old_dependency_caches(cache_root, cache_dir)
    return cache_dir


def build_bundle(source_root: Path, output_dir: Path) -> None:
    requirements = source_root / "requirements.txt"
    dependency_cache = _ensure_dependency_cache(source_root, requirements)

    _remove_tree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    _copy_tree(dependency_cache, output_dir)
    _copy_tree(source_root / "lambda", output_dir / "lambda")
    _copy_tree(source_root / "src", output_dir / "src")
    _cleanup_bundle(output_dir)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-root",
        default=str(Path(__file__).resolve().parents[1]),
        help="Path to backend source root.",
    )
    parser.add_argument(
        "--output-dir",
        default="",
        help="Output directory for the bundled assets.",
    )
    parser.add_argument(
        "--deps-only",
        action="store_true",
        help="Warm dependency cache without building bundle output.",
    )
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    _ensure_python_version()
    args = _parse_args()
    source_root = Path(args.source_root).resolve()
    output_dir = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else source_root / ".lambda-build" / "base"
    )
    requirements = source_root / "requirements.txt"

    if args.deps_only:
        _ensure_dependency_cache(source_root, requirements)
        logger.info("Lambda dependency cache is ready.")
        return

    logger.info("Building Lambda bundle in %s", output_dir)
    build_bundle(source_root, output_dir)
    logger.info("Lambda bundle ready.")


if __name__ == "__main__":
    main()
