#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_ONLY="${1:-}"

red() { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

ensure_command() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    green "[ok] $cmd found"
    return 0
  fi
  return 1
}

install_with_brew() {
  local pkg="$1"
  if ! command -v brew >/dev/null 2>&1; then
    red "[missing] Homebrew not found; cannot auto-install $pkg"
    return 1
  fi

  yellow "[install] Installing $pkg with Homebrew..."
  if brew install "$pkg"; then
    green "[ok] Installed $pkg"
    return 0
  fi

  red "[failed] Could not install $pkg with Homebrew"
  return 1
}

cd "$ROOT_DIR"

yellow "Checking deep-analysis local prerequisites..."

missing=0
if ! ensure_command "ffmpeg"; then
  if ! install_with_brew "ffmpeg"; then
    missing=1
  fi
fi

if ! ensure_command "yt-dlp"; then
  if ! install_with_brew "yt-dlp"; then
    missing=1
  fi
fi

if [[ "$missing" -ne 0 ]]; then
  red "Some required tools are missing. Install them and re-run: npm run dev:deep"
  exit 1
fi

if [[ ! -f .env.local ]]; then
  yellow ".env.local not found. Creating from .env.example"
  cp .env.example .env.local
  yellow "Add OPENAI_API_KEY to .env.local before deep analysis."
fi

if ! rg -q '^OPENAI_API_KEY=.+$' .env.local; then
  red "OPENAI_API_KEY is missing in .env.local"
  yellow "Set it, then re-run: npm run dev:deep"
  exit 1
fi

if [[ "$CHECK_ONLY" == "--check" ]]; then
  green "All deep-analysis prerequisites are ready."
  exit 0
fi

green "Starting app in dev mode..."
exec npm run dev
