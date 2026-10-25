#!/bin/sh
set -eu

version=$(dpkg-query -W -f='${Version}' libbrotli1) || {
    echo 'libbrotli1 is not installed' >&2
    exit 1
}
case "$version" in
    1.0.9-*) floor=1.0.9-2+deb12u1 ;;
    1.1.0-*) floor=1.1.0-2+deb13u1 ;;
    *) echo "libbrotli1 has an unverified package version: $version" >&2; exit 1 ;;
esac
dpkg --compare-versions "$version" ge "$floor" || {
    echo "libbrotli1 $version is below the CVE-2026-111497 fixed package $floor" >&2
    exit 1
}
printf 'libbrotli1: %s (fixed floor: %s)\n' "$version" "$floor"
