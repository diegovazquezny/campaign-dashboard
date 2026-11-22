module Metrics
  # One page of calls for GET /api/calls. Never selects caller_number_hash.
  # `outcome` is one of Outcome::ALL or "awaiting" (answered, no outcome yet);
  # `campaign_id` is a campaign id or "none" (unattributed). Both are validated
  # by the caller.
  module CallList
    PAGE_SIZE = 25
    AWAITING = "awaiting".freeze
    NO_CAMPAIGN = "none".freeze

    module_function

    def call(from:, to:, page:, location_id: nil, campaign_id: nil, outcome: nil)
      scope = Call.where(local_date: from..to)
      scope = scope.where(location_id: location_id) if location_id
      scope = filter_campaign(scope, campaign_id)
      scope = filter_outcome(scope, outcome)

      total = scope.count
      rows = scope.joins(:location).left_joins(:campaign)
                  .select("calls.*", "locations.name AS location_name", "locations.timezone AS location_timezone",
                          "campaigns.name AS campaign_name")
                  .reorder(started_at: :desc, call_id: :desc)
                  .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE)

      { page: page, page_size: PAGE_SIZE, total: total, calls: rows.map { |call| row(call) } }
    end

    def filter_campaign(scope, campaign_id)
      return scope if campaign_id.nil?

      campaign_id == NO_CAMPAIGN ? scope.where(campaign_id: nil) : scope.where(campaign_id: campaign_id)
    end

    def filter_outcome(scope, outcome)
      return scope if outcome.nil?

      outcome == AWAITING ? scope.where(answered: true, outcome: nil) : scope.where(outcome: outcome)
    end

    def row(call)
      {
        call_id: call.call_id,
        started_at: call.started_at.utc.iso8601,
        ended_at: call.ended_at.utc.iso8601,
        local_date: call.local_date.iso8601,
        timezone: call.location_timezone,
        duration_seconds: call.duration_seconds,
        answered: call.answered,
        outcome: call.outcome,
        revenue_cents: call.revenue_cents,
        agent_id: call.agent_id,
        tracking_number: call.tracking_number,
        campaign: call.campaign_id && { id: call.campaign_id, name: call.campaign_name },
        channel: call.marketing_channel,
        location: { id: call.location_id, name: call.location_name }
      }
    end
  end
end
