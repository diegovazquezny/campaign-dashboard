module Metrics
  # GET /api/campaigns/metrics (PLAN.md section 8): per-campaign rows plus the
  # totals row, from one SQL statement. `call` returns { range:, rows:, totals: };
  # `rows` returns just the rows. Row order is CampaignCounts': campaigns by id,
  # then "No campaign".
  #
  # The statement is a `spent` CTE (counts + budget + covered days + spend_cents)
  # and a `combined` CTE that unions the rows with one totals row aggregated
  # from `spent`, so spend is computed once. The totals row is tagged
  # `is_total`, never inferred from campaign_id (NULL is "No campaign").
  #
  # Totals follow section 7: counts and revenue are summed over every row,
  # including "No campaign"; `unique_callers` is a count(DISTINCT) over all
  # calls in range and office, never a sum of rows; rates are recomputed from
  # the summed counts; `spend_cents` sums non-null row spend (nil if all nil).
  # `paid` holds the spend ratios over rows with non-null spend only.
  #
  # Counts and money are bigint; ratios are float8, NULL when the denominator
  # is NULL or 0. `channel_breakdown` appears only on the "No campaign" row.
  module CampaignMetrics
    module_function

    ROW_KEYS = %i[campaign_id name channel calls unique_callers new_callers booked booking_rate unanswered_rate
                  awaiting_outcome revenue_cents spend_cents revenue_per_spend spend_per_booking_cents].freeze
    TOTAL_KEYS = %i[calls unique_callers new_callers booked booking_rate unanswered_rate awaiting_outcome
                    revenue_cents spend_cents].freeze

    def call(from:, to:, location_id: nil)
      rows, totals = fetch_all(from:, to:, location_id:)
      { range: { from: from, to: to }, rows: rows, totals: totals }
    end

    def rows(from:, to:, location_id: nil)
      fetch_all(from:, to:, location_id:).first
    end

    def fetch_all(from:, to:, location_id:)
      result = ActiveRecord::Base.connection.select_all(sql(from:, to:, location_id:)).map(&:symbolize_keys)
      total = result.find { |r| r[:is_total] }
      rows = result.reject { |r| r[:is_total] }.map { |r| row_hash(r) }
      [ rows, total_hash(total) ]
    end
    private_class_method :fetch_all

    def row_hash(row)
      hash = row.slice(*ROW_KEYS)
      return hash unless row[:campaign_id].nil?

      breakdown = row[:channel_breakdown]
      hash.merge(channel_breakdown: breakdown.is_a?(String) ? JSON.parse(breakdown) : breakdown)
    end
    private_class_method :row_hash

    def total_hash(row)
      row.slice(*TOTAL_KEYS).merge(
        paid: {
          revenue_cents: row[:paid_revenue_cents], booked: row[:paid_booked], spend_cents: row[:spend_cents],
          revenue_per_spend: row[:revenue_per_spend], spend_per_booking_cents: row[:spend_per_booking_cents]
        }
      )
    end
    private_class_method :total_hash

    def sql(from:, to:, location_id: nil)
      filtered = !location_id.nil?
      coverage = DataCoverage.current
      covered_days = SpendSql.covered_days(from: from, to: to, cov_from: coverage&.from, cov_to: coverage&.to)

      <<~SQL.squish
        WITH spent AS (
          SELECT base.*, #{SpendSql.total_cents(filtered:)} AS spend_cents
          FROM (
            SELECT k.*, k.calls AS office_calls, b.daily_budget_cents, #{covered_days} AS covered_days
            FROM (#{CampaignCounts.sql(from:, to:, location_id:)}) k
            LEFT JOIN campaigns b ON b.id = k.campaign_id
          ) base
        ),
        combined AS (
          SELECT FALSE AS is_total, campaign_id, name, channel, calls, unique_callers, new_callers, booked,
            unanswered, awaiting_outcome, revenue_cents, spend_cents,
            revenue_cents AS ratio_revenue_cents, booked AS ratio_booked, channel_breakdown,
            NULL::bigint AS paid_revenue_cents, NULL::bigint AS paid_booked
          FROM spent
          UNION ALL
          SELECT TRUE, NULL, NULL, NULL,
            COALESCE(sum(calls), 0)::bigint,
            (#{distinct_callers(from:, to:, location_id:)}),
            COALESCE(sum(new_callers), 0)::bigint, COALESCE(sum(booked), 0)::bigint,
            COALESCE(sum(unanswered), 0)::bigint, COALESCE(sum(awaiting_outcome), 0)::bigint,
            COALESCE(sum(revenue_cents), 0)::bigint, sum(spend_cents)::bigint,
            COALESCE(sum(revenue_cents) FILTER (WHERE spend_cents IS NOT NULL), 0)::bigint,
            COALESCE(sum(booked) FILTER (WHERE spend_cents IS NOT NULL), 0)::bigint,
            NULL::jsonb,
            COALESCE(sum(revenue_cents) FILTER (WHERE spend_cents IS NOT NULL), 0)::bigint,
            COALESCE(sum(booked) FILTER (WHERE spend_cents IS NOT NULL), 0)::bigint
          FROM spent
        )
        SELECT
          is_total, campaign_id, name, channel, calls, unique_callers, new_callers, booked,
          booked::float8 / NULLIF(calls, 0) AS booking_rate,
          unanswered::float8 / NULLIF(calls, 0) AS unanswered_rate,
          awaiting_outcome, revenue_cents, spend_cents,
          ratio_revenue_cents::float8 / NULLIF(spend_cents, 0) AS revenue_per_spend,
          spend_cents::float8 / NULLIF(ratio_booked, 0) AS spend_per_booking_cents,
          channel_breakdown, paid_revenue_cents, paid_booked
        FROM combined
        ORDER BY is_total, campaign_id NULLS LAST
      SQL
    end

    # Distinct callers over every call in range and office (never a sum of rows).
    def distinct_callers(from:, to:, location_id:)
      conn = ActiveRecord::Base.connection
      office = location_id.nil? ? "" : "AND location_id = #{conn.quote(location_id.to_s)}"
      <<~SQL.squish
        SELECT count(DISTINCT caller_number_hash) FROM calls
        WHERE local_date BETWEEN #{conn.quote(from.to_date.iso8601)}::date AND #{conn.quote(to.to_date.iso8601)}::date #{office}
      SQL
    end
    private_class_method :distinct_callers
  end
end
