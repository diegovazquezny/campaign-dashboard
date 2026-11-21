module Importer
  # Orchestrates one import inside a single transaction. requires_new makes a
  # failure roll back even when an outer transaction (transactional specs) is open.
  class Runner
    def initialize(data_dir)
      @data_dir = data_dir.to_s
    end

    def call
      ActiveRecord::Base.transaction(requires_new: true) do
        refs = ReferenceLoader.new(@data_dir).call
        read = CallsReader.new(File.join(@data_dir, CallsReader::FILE),
                               location_ids: refs.location_ids, campaign_ids: refs.campaign_ids).call
        written = CallsWriter.new(read.rows).call
        build_result(refs, read, written)
      end
    end

    private

    def build_result(refs, read, written)
      calls = read.rows.map { |r| r.attributes[:call_id] }.uniq.size
      Result.new(
        locations: refs.locations, campaigns: refs.campaigns,
        rows: read.rows_read, rejected: read.rejections.size, calls: calls,
        older_versions_dropped: read.rows.size - calls, duplicates_collapsed: read.duplicates_collapsed,
        inserted: written.inserted, updated: written.updated, local_dates_recomputed: 0,
        rejections: refs.rejections + read.rejections
      )
    end
  end
end
