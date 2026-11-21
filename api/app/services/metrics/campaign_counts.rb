module Metrics
  # Per-campaign counts over [from, to] (and an optional office), built on
  # CallFacts. `sql` is a self-contained statement (WITH ... SELECT) that can
  # be wrapped in parentheses and used as a subquery; `call` runs it.
  #
  # Columns: campaign_id, name, channel, calls, unique_callers, new_callers,
  # booked, unanswered, awaiting_outcome, revenue_cents (all office figures),
  # campaign_calls (calls in range at any office), channel_breakdown (jsonb,
  # only on the "No campaign" row).
  #
  # Every campaign is listed (zeros when it has no calls in range or at the
  # office). The "No campaign" row (campaign_id NULL) appears only when it has
  # office calls in range. Rows: campaigns by id, "No campaign" last.
  module CampaignCounts
    module_function

    def sql(from:, to:, location_id: nil)
      <<~SQL.squish
        WITH call_facts AS (#{CallFacts.sql(from:, to:, location_id:)}),
        per_campaign AS (
          SELECT
            campaign_id,
            count(*) FILTER (WHERE at_office) AS calls,
            count(DISTINCT caller_number_hash) FILTER (WHERE at_office) AS unique_callers,
            count(*) FILTER (WHERE at_office AND is_new) AS new_callers,
            count(*) FILTER (WHERE at_office AND booked) AS booked,
            count(*) FILTER (WHERE at_office AND unanswered) AS unanswered,
            count(*) FILTER (WHERE at_office AND awaiting) AS awaiting_outcome,
            COALESCE(sum(revenue_cents) FILTER (WHERE at_office), 0)::bigint AS revenue_cents,
            count(*) AS campaign_calls
          FROM call_facts
          GROUP BY campaign_id
        )
        SELECT c.id AS campaign_id, c.name, c.channel,
          COALESCE(p.calls, 0) AS calls,
          COALESCE(p.unique_callers, 0) AS unique_callers,
          COALESCE(p.new_callers, 0) AS new_callers,
          COALESCE(p.booked, 0) AS booked,
          COALESCE(p.unanswered, 0) AS unanswered,
          COALESCE(p.awaiting_outcome, 0) AS awaiting_outcome,
          COALESCE(p.revenue_cents, 0)::bigint AS revenue_cents,
          COALESCE(p.campaign_calls, 0) AS campaign_calls,
          NULL::jsonb AS channel_breakdown
        FROM campaigns c
        LEFT JOIN per_campaign p ON p.campaign_id = c.id
        UNION ALL
        SELECT NULL::text, 'No campaign', NULL::text,
          p.calls, p.unique_callers, p.new_callers, p.booked, p.unanswered,
          p.awaiting_outcome, p.revenue_cents, p.campaign_calls,
          (SELECT jsonb_agg(jsonb_build_object('channel', b.marketing_channel, 'calls', b.n)
                            ORDER BY b.n DESC, b.marketing_channel)
           FROM (SELECT marketing_channel, count(*) AS n
                 FROM call_facts
                 WHERE campaign_id IS NULL AND at_office
                 GROUP BY marketing_channel) b)
        FROM per_campaign p
        WHERE p.campaign_id IS NULL AND p.calls > 0
        ORDER BY campaign_id NULLS LAST
      SQL
    end

    # Rows as hashes with symbol keys; channel_breakdown is parsed to
    # [{ "channel", "calls" }] (nil except on the "No campaign" row).
    def call(from:, to:, location_id: nil)
      ActiveRecord::Base.connection.select_all(sql(from:, to:, location_id:)).map do |row|
        row = row.symbolize_keys
        breakdown = row[:channel_breakdown]
        row.merge(channel_breakdown: breakdown.is_a?(String) ? JSON.parse(breakdown) : breakdown)
      end
    end
  end
end
