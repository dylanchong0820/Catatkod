# WHO ICD-11 MMS catalogue included with CatatKod

Source file supplied by the user: `SimpleTabulation-ICD-11-MMS-en.zip`.

- Source export version timestamp: 2026-10-12 03:20 UTC (as recorded in the file).
- Rows: 37,096 (28 chapters, 1,363 blocks, 35,705 category rows).
- This is the WHO English MMS **Simple Tabulation** export. It contains the source identifiers, codes where assigned, English titles, hierarchy and grouping fields.
- Rows with `_NOCODEASSIGNED` are retained as in the source; do not treat that literal as a valid ICD-11 code. Some categories may need fuller detail from the WHO Coding Tool / API for postcoordination or code validation.
- No Malay colloquial synonyms are inferred or added to this official catalogue. These must be maintained in a separate reviewed mapping layer.
- Do not treat the catalogue alone as a trained classifier or as clinical validation. Human review is required before coding is accepted.

The CSV was converted from the supplied XLSX sheet, retaining classification data fields and adding source metadata. Check the current Malaysian MOH-required release before production use.
