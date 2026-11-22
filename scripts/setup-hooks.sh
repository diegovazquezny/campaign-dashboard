#!/bin/sh
# Enable the repo's shared git hooks in .githooks/. Safe to run repeatedly.
# Exits quietly outside a git checkout (e.g. Docker builds).
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0

if [ "$(git config --get core.hooksPath)" = ".githooks" ]; then
  exit 0  # already installed
fi

git config core.hooksPath .githooks
chmod +x .githooks/*
[ -f .env ] || cp .env.example .env
echo "Git hooks enabled (pre-commit: rubocop + eslint, pre-push: blocks pushes to main)."
echo "Pre-commit runs on the host, not Docker: run 'bundle install' in api/ (Ruby per api/.ruby-version)."
