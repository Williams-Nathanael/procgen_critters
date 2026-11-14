#!/bin/sh
# Download the public PDFs used by `npm run test:pdfs` into out/tmp/pdfs/dl (git-ignored).
d="$(dirname "$0")/../out/tmp/pdfs/dl"; mkdir -p "$d"
curl -sSL -o "$d/book.pdf" https://www.gnu.org/software/emacs/manual/pdf/emacs.pdf            # 800+ page manual
curl -sSL -o "$d/form.pdf" https://www.irs.gov/pub/irs-pdf/f1040.pdf                          # fillable tax form
curl -sSL -o "$d/scan.pdf" https://archive.org/download/suiprincipiidir00alimgoog/suiprincipiidir00alimgoog.pdf # scanned book
