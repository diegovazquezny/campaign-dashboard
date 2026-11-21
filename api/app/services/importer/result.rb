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
end
