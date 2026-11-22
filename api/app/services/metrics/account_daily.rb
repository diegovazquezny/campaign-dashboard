module Metrics
  # GET /api/daily: one row per date in [from, to], zero-filled, across all
  # calls including "No campaign", so day sums equal CampaignMetrics `totals`.
  # No spend. `call` returns { range: { from:, to: }, days: [...] }.
  module AccountDaily
    module_function

    def call(from:, to:, location_id: nil)
      days = ActiveRecord::Base.connection.select_all(DailySeries.account_sql(from:, to:, location_id:))
                               .map(&:symbolize_keys)
      { range: { from: from, to: to }, days: days }
    end
  end
end
