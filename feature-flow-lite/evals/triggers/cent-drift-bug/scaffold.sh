#!/bin/bash
# seeds the shared shop fixture (plugin eval only runs scripts inside the case dir)
exec bash "$(dirname "${BASH_SOURCE[0]}")/../seed-shop.sh"
