#!/usr/bin/env sh
set -eu

PERPS_ROUTE_DIRECTORY="src/app/(networks)/(evm)/perps"
PERPS_LIBRARY_DIRECTORY="src/lib/perps"
NEXT_DEV_TYPES_DIRECTORY=".next/dev/types"
PERPS_BACKUP_DIRECTORY=""

restore_perps_files() {
  if [ -z "$PERPS_BACKUP_DIRECTORY" ]; then
    return
  fi

  if [ -d "$PERPS_BACKUP_DIRECTORY/perps-library" ]; then
    mv "$PERPS_LIBRARY_DIRECTORY/config.ts" "$PERPS_BACKUP_DIRECTORY/perps-library/config.ts"
    rmdir "$PERPS_LIBRARY_DIRECTORY"
    mv "$PERPS_BACKUP_DIRECTORY/perps-library" "$PERPS_LIBRARY_DIRECTORY"
  fi

  if [ -d "$PERPS_BACKUP_DIRECTORY/perps-route" ]; then
    mv "$PERPS_BACKUP_DIRECTORY/perps-route" "$PERPS_ROUTE_DIRECTORY"
  fi

  if [ -d "$PERPS_BACKUP_DIRECTORY/next-dev-types" ]; then
    mkdir -p "$(dirname "$NEXT_DEV_TYPES_DIRECTORY")"
    mv "$PERPS_BACKUP_DIRECTORY/next-dev-types" "$NEXT_DEV_TYPES_DIRECTORY"
  fi

  if [ -d "$PERPS_BACKUP_DIRECTORY" ]; then
    rmdir "$PERPS_BACKUP_DIRECTORY"
  fi
}

trap restore_perps_files EXIT
trap 'exit 1' HUP INT TERM

if [ "${NEXT_PUBLIC_DISABLE_PERPS:-}" = "true" ]; then
  PERPS_BACKUP_DIRECTORY="$(mktemp -d)"

  mv "$PERPS_ROUTE_DIRECTORY" "$PERPS_BACKUP_DIRECTORY/perps-route"
  mv "$PERPS_LIBRARY_DIRECTORY" "$PERPS_BACKUP_DIRECTORY/perps-library"
  mkdir "$PERPS_LIBRARY_DIRECTORY"
  mv "$PERPS_BACKUP_DIRECTORY/perps-library/config.ts" "$PERPS_LIBRARY_DIRECTORY/config.ts"

  if [ -d "$NEXT_DEV_TYPES_DIRECTORY" ]; then
    mv "$NEXT_DEV_TYPES_DIRECTORY" "$PERPS_BACKUP_DIRECTORY/next-dev-types"
  fi

  echo "Building without Perps and the private TradingView library."
fi

NODE_OPTIONS=--max-old-space-size=8192 next build
