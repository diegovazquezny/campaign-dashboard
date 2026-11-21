module Metrics
  # GET /api/campaigns/:id/daily (PLAN.md section 8): one row per date in
  # [from, to], zero-filled in the database with generate_series. `call`
  # returns { campaign: { id:, name: }, days: [...] }.
  #
  # Counts and revenue are office figures (FILTER (WHERE at_office)) for this
  # campaign's calls on `local_date`. `campaign_calls` and `office_calls` come
  # from the whole range (not per day), from the same CallFacts scan, and feed
  # SpendSql.daily_cents so the daily spend telescopes to the table's
  # SpendSql.total_cents. `covered_through` is covered_days(from, day).
  module CampaignDaily
    module_function

    DAY_KEYS = %i[date calls booked revenue_cents spend_cents].freeze

    def call(campaign:, from:, to:, location_id: nil)
      rows = ActiveRecord::Base.connection.select_all(sql(campaign:, from:, to:, location_id:)).map(&:symbolize_keys)
      { campaign: { id: campaign.id, name: campaign.name }, days: rows.map { |r| r.slice(*DAY_KEYS) } }
    end

    def sql(campaign:, from:, to:, location_id: nil)
      conn = ActiveRecord::Base.connection
      coverage = DataCoverage.current
      covered_day = coverage ? "d.day BETWEEN #{conn.quote(coverage.from.iso8601)}::date AND #{conn.quote(coverage.to.iso8601)}::date" : "FALSE"
      through = SpendSql.covered_days(from: from, to: "d.day", cov_from: coverage&.from, cov_to: coverage&.to)

      <<~SQL.squish
        WITH facts AS (#{CallFacts.sql(from:, to:, location_id:)}),
        mine AS (SELECT * FROM facts WHERE campaign_id = #{conn.quote(campaign.id)}),
        totals AS (
          SELECT count(*) AS campaign_calls, count(*) FILTER (WHERE at_office) AS office_calls FROM mine
        ),
        per_day AS (
          SELECT local_date,
            count(*) FILTER (WHERE at_office) AS calls,
            count(*) FILTER (WHERE at_office AND booked) AS booked,
            COALESCE(sum(revenue_cents) FILTER (WHERE at_office), 0)::bigint AS revenue_cents
          FROM mine GROUP BY local_date
        ),
        days AS (
          SELECT d.day AS date,
            COALESCE(p.calls, 0)::bigint AS calls, COALESCE(p.booked, 0)::bigint AS booked,
            COALESCE(p.revenue_cents, 0)::bigint AS revenue_cents,
            #{conn.quote(campaign.daily_budget_cents)}::integer AS daily_budget_cents,
            t.office_calls, t.campaign_calls,
            (#{covered_day}) AS covered_day, #{through} AS covered_through
          FROM (SELECT g::date AS day FROM generate_series(#{conn.quote(from.to_date.iso8601)}::date, #{conn.quote(to.to_date.iso8601)}::date, interval '1 day') g) d
          CROSS JOIN totals t
          LEFT JOIN per_day p ON p.local_date = d.day
        )
        SELECT date, calls, booked, revenue_cents, #{SpendSql.daily_cents(filtered: !location_id.nil?)} AS spend_cents
        FROM days ORDER BY date
      SQL
    end
  end
end
