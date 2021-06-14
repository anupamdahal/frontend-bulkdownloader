#!/bin/bash

src='test.txt'

mkdir "test-files" "temp"

for i in {0..9}; do
  cp "$src" "temp/test-$i.txt"
done

for i in {0..99}; do
  zip -r "test-files/test-$i.zip" "temp"
done

ls "test-files" | perl -e 'use JSON; @in=grep(s/\n$//, <>); print "{\"urls\":"; print encode_json(\@in).""; print "}"' > "urls.json"

rm "test.txt"
rm -rf "temp"