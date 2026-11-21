module Importer
  # Outcome of Importer.run.
  #
  # rows                  data rows read from calls.csv
  # rejected              calls.csv rows rejected (reference files report their own counts)
  # calls                 distinct call_ids among the valid rows
  # older_versions_dropped valid distinct rows minus calls (exact duplicates are counted separately)
  # duplicates_collapsed  exact duplicate rows folded into one
  # inserted / updated    calls rows written by the upsert
  # local_dates_recomputed stale local_date values fixed afterwards
  # rejections            every rejection, reference files first
  Result = Struct.new(
    :locations, :campaigns, :rows, :rejected, :calls, :older_versions_dropped,
    :duplicates_collapsed, :inserted, :updated, :local_dates_recomputed, :rejections,
    keyword_init: true
  )

  class Result
    MAX_LISTED_REJECTIONS = 100

    # Human-readable report: one line per file, then the first 100 rejections.
    def summary
      lines = [
        reference_line("locations.csv", locations),
        reference_line("campaigns.csv", campaigns),
        "calls.csv: #{n(rows)} rows → #{n(calls)} calls (#{n(older_versions_dropped)} older versions dropped, " \
        "#{n(rejected)} rejected; #{n(inserted)} inserted, #{n(updated)} updated, " \
        "#{n(local_dates_recomputed)} local dates recomputed)"
      ]
      lines << "#{n(duplicates_collapsed)} exact duplicate rows collapsed" if duplicates_collapsed.positive?
      listed = rejections.first(MAX_LISTED_REJECTIONS)
      lines.concat(listed.map { |r| "  #{r.file}:#{r.line}: #{r.reason}" })
      hidden = rejections.size - listed.size
      lines << "  … and #{n(hidden)} more rejected rows" if hidden.positive?
      lines.join("\n")
    end

    private

    def reference_line(file, counts)
      loaded = counts.inserted + counts.updated + counts.unchanged
      "#{file}: #{n(loaded)} loaded, #{n(counts.rejected)} rejected"
    end

    def n(number)
      ActiveSupport::NumberHelper.number_to_delimited(number)
    end
  end
end
