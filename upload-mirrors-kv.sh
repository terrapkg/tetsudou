#!/bin/sh

: "${LOCAL:=false}"

pnpm wrangler kv key put --binding=TETSUDOU --local="$LOCAL" "mirrors" "$(cat mirrors.json)"
