# Namespace for the CSV import pipeline (see plans/PLAN.md section 6).
module Importer
  # A row that failed validation. `line` is the physical file line (header = 1).
  Rejection = Struct.new(:file, :line, :reason, keyword_init: true)

  # Raised for problems that abort the whole import (missing file, bad header).
  class Error < StandardError; end

  DEFAULT_DATA_DIR = Rails.root.join("..", "data").to_s

  # Imports locations.csv, campaigns.csv and calls.csv from data_dir in a single
  # transaction: either everything is loaded or nothing changes. Returns an
  # Importer::Result.
  def self.run(data_dir: ENV.fetch("DATA_DIR", DEFAULT_DATA_DIR))
    Runner.new(data_dir).call
  end
end
