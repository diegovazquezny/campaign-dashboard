module Metrics
  # SQL pieces shared by the daily endpoints: the zero-filled date series and
  # the per-day office aggregation over a CallFacts CTE. Both bucket by
  # `local_date` and count office figures only (FILTER (WHERE at_office)).
  module DailySeries
    module_function

    # One row per date in [from, to] as `day`, for use as a FROM item.
    def dates_sql(from:, to:)
      conn = ActiveRecord::Base.connection
      "(SELECT g::date AS day FROM generate_series(#{conn.quote(from.to_date.iso8601)}::date, " \
        "#{conn.quote(to.to_date.iso8601)}::date, interval '1 day') g)"
    end

    # SELECT body: one row per local_date that has calls in `source` (a CTE name
    # with CallFacts columns), with calls, booked and revenue_cents.
    def per_day_sql(source:)
      <<~SQL.squish
        SELECT local_date,
          count(*) FILTER (WHERE at_office) AS calls,
          count(*) FILTER (WHERE at_office AND booked) AS booked,
          COALESCE(sum(revenue_cents) FILTER (WHERE at_office), 0)::bigint AS revenue_cents
        FROM #{source} GROUP BY local_date
      SQL
    end

    # Full statement for the account-wide series (every call, including "No campaign").
    def account_sql(from:, to:, location_id: nil)
      <<~SQL.squish
        WITH facts AS (#{CallFacts.sql(from:, to:, location_id:)}),
        per_day AS (#{per_day_sql(source: "facts")})
        SELECT d.day AS date,
          COALESCE(p.calls, 0)::bigint AS calls, COALESCE(p.booked, 0)::bigint AS booked,
          COALESCE(p.revenue_cents, 0)::bigint AS revenue_cents
        FROM #{dates_sql(from:, to:)} d
        LEFT JOIN per_day p ON p.local_date = d.day
        ORDER BY d.day
      SQL
    end
  end
end
