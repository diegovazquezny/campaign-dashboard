module Metrics
  # The `rows` of GET /api/campaigns/metrics (PLAN.md section 8): per-campaign
  # counts from CampaignCounts, budgeted spend from SpendSql and the ratios,
  # all in one SQL statement. Row order is CampaignCounts': campaigns by id,
  # then "No campaign".
  #
  # The statement is three layers over the counts so each can reference the one
  # below by column name: `base` (counts + budget + covered days), `spent`
  # (adds spend_cents), and the final select (adds the ratios).
  #
  # Counts and money are bigint; ratios are float8, NULL when the denominator is
  # NULL or 0. Rows are hashes with symbol keys; `channel_breakdown` appears
  # only on the "No campaign" row.
  module CampaignMetrics
    module_function

    def rows(from:, to:, location_id: nil)
      result = ActiveRecord::Base.connection.select_all(sql(from:, to:, location_id:))
      result.map do |row|
        row = row.symbolize_keys
        breakdown = row.delete(:channel_breakdown)
        next row unless row[:campaign_id].nil?

        row.merge(channel_breakdown: breakdown.is_a?(String) ? JSON.parse(breakdown) : breakdown)
      end
    end

    def sql(from:, to:, location_id: nil)
      filtered = !location_id.nil?
      coverage = DataCoverage.current
      covered_days = SpendSql.covered_days(from: from, to: to, cov_from: coverage&.from, cov_to: coverage&.to)

      <<~SQL.squish
        SELECT
          campaign_id, name, channel, calls, unique_callers, new_callers, booked,
          booked::float8 / NULLIF(calls, 0) AS booking_rate,
          unanswered::float8 / NULLIF(calls, 0) AS unanswered_rate,
          awaiting_outcome, revenue_cents, spend_cents,
          revenue_cents::float8 / NULLIF(spend_cents, 0) AS revenue_per_spend,
          spend_cents::float8 / NULLIF(booked, 0) AS spend_per_booking_cents,
          channel_breakdown
        FROM (
          SELECT base.*, #{SpendSql.total_cents(filtered:)} AS spend_cents
          FROM (
            SELECT k.*, k.calls AS office_calls, b.daily_budget_cents, #{covered_days} AS covered_days
            FROM (#{CampaignCounts.sql(from:, to:, location_id:)}) k
            LEFT JOIN campaigns b ON b.id = k.campaign_id
          ) base
        ) spent
        ORDER BY campaign_id NULLS LAST
      SQL
    end
  end
end
