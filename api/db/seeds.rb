# Imports the CSVs on first start (see plans/PLAN.md section 6). The import is a
# single transaction, so an empty calls table means no import has succeeded yet:
# a failed first import is retried on the next start, and every later start
# costs one indexed check. Use `bin/rails import:all` to force a re-import.
puts Importer.run.summary unless Call.exists?
