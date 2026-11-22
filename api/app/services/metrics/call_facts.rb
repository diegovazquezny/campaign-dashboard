module Metrics
  # The single source of per-call data for every metric (PLAN.md section 7).
  # `sql` returns a SELECT with one row per call whose `local_date` is in
  # [from, to], for use as a CTE or subquery body.
  #
  # The office filter is a flag, not a WHERE: `at_office` is true for every row
  # without a location filter, otherwise `location_id = :location_id`. Rows at
  # other offices stay in so the campaign-wide call count (the call-share
  # denominator) and the office count come from one scan; aggregate the office
  # figures with FILTER (WHERE at_office).
  #
  # `is_new` is true when no earlier call, ordered by (started_at, call_id),
  # exists from the same caller in the unfiltered `calls` table, so it ignores
  # range, office and campaign. It is only evaluated for at_office rows (false
  # elsewhere), and probes the (caller_number_hash, started_at, call_id) index.
  module CallFacts
    module_function

    # `from` and `to` are Dates; `location_id` is a String or nil.
    def sql(from:, to:, location_id: nil)
      conn = ActiveRecord::Base.connection
      at_office = location_id.nil? ? "TRUE" : "c.location_id = #{conn.quote(location_id.to_s)}"

      <<~SQL.squish
        SELECT
          c.call_id,
          c.local_date,
          c.campaign_id,
          c.marketing_channel,
          c.caller_number_hash,
          (#{at_office}) AS at_office,
          (CASE WHEN #{at_office} THEN NOT EXISTS (
            SELECT 1 FROM calls prior
            WHERE prior.caller_number_hash = c.caller_number_hash
              AND (prior.started_at, prior.call_id) < (c.started_at, c.call_id)
          ) ELSE FALSE END) AS is_new,
          (c.outcome IS NOT DISTINCT FROM 'booked') AS booked,
          (NOT c.answered) AS unanswered,
          (c.outcome IS NOT DISTINCT FROM 'missed') AS missed,
          (c.outcome IS NOT DISTINCT FROM 'voicemail') AS voicemail,
          (c.answered AND c.outcome IS NULL) AS awaiting,
          COALESCE(c.revenue_cents, 0)::bigint AS revenue_cents
        FROM calls c
        WHERE c.local_date BETWEEN #{conn.quote(from.to_date.iso8601)}::date AND #{conn.quote(to.to_date.iso8601)}::date
      SQL
    end
  end
end
