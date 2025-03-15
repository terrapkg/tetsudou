#!/bin/sh

: "${LOCAL:=false}"

for filename in repos/*.json; do
  base="$(basename $filename)"
  key="${base%%.*}"
  pnpm wrangler kv key put --binding=TETSUDOU --local="$LOCAL" "mirrors/$key" "$(cat $filename)"
done
