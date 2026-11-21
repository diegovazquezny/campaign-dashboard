# Namespace for the CSV import pipeline (see plans/PLAN.md section 6).
# Importer.run is added in a later PR.
module Importer
  # A row that failed validation. `line` is the physical file line (header = 1).
  Rejection = Struct.new(:file, :line, :reason, keyword_init: true)

  # Raised for problems that abort the whole import (missing file, bad header).
  class Error < StandardError; end
end
