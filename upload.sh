#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

rm -rf build dist *.egg-info
python -m build
python -m twine upload dist/*
