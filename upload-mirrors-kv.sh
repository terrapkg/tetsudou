#!/bin/sh

: "${LOCAL:=false}"

bunx wrangler kv key put --binding=TETSUDOU --local="$LOCAL" "mirrors" "$(cat mirrors.json)"
