module Metrics
  # The span of `calls.local_date` the data covers, and when it last changed.
  # `current` returns nil when there are no calls.
  class DataCoverage
    Result = Data.define(:from, :to, :latest_update_at)

    def self.current
      from, to, latest = Call.pick(Arel.sql("MIN(local_date)"), Arel.sql("MAX(local_date)"), Arel.sql("MAX(source_updated_at)"))
      return nil if from.nil?

      Result.new(from: from, to: to, latest_update_at: latest)
    end
  end
end
