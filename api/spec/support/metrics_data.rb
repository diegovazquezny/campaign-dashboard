require "digest"

# Hand-built data for metrics specs, so each scenario's known answer sits next
# to its assertion. Included in every example group. Despite the `build_`
# prefix, every helper persists its record, and is idempotent per id.
module MetricsData
  def build_location(id: "loc_01", name: "Office #{id}", timezone: "America/New_York")
    Location.find_or_create_by!(id: id) do |location|
      location.name = name
      location.timezone = timezone
    end
  end

  def build_campaign(id: "cmp_01", name: "Campaign #{id}", channel: "paid_search", daily_budget_cents: 10_000)
    Campaign.find_or_create_by!(id: id) do |campaign|
      campaign.name = name
      campaign.channel = channel
      campaign.daily_budget_cents = daily_budget_cents
    end
  end

  # Creates an answered call with no outcome by default (awaiting outcome).
  # `local_date` defaults to the date of `started_at` in the office's timezone.
  # Pass `campaign: nil` for an unattributed call, `outcome: "booked"` (with
  # optional `revenue_cents:`) for a booking, and `answered: false` for a
  # missed call.
  def build_call(id: nil, started_at: Time.utc(2026, 9, 1, 15), duration_seconds: 60, caller_number: "caller_01",
                 campaign: :default, location: :default, marketing_channel: nil, answered: true,
                 outcome: :default, revenue_cents: nil, local_date: nil)
    location = location == :default ? build_location : resolve(location, Location)
    campaign = campaign == :default ? build_campaign : resolve(campaign, Campaign)
    outcome = (answered ? nil : "missed") if outcome == :default
    revenue_cents ||= 0 if outcome.to_s == "booked"
    @call_sequence = (@call_sequence || 0) + 1

    Call.create!(
      call_id: id || "call_#{@call_sequence}",
      started_at: started_at,
      ended_at: started_at + duration_seconds,
      duration_seconds: duration_seconds,
      caller_number_hash: Digest::SHA256.hexdigest(caller_number.to_s),
      tracking_number: "+15550000000",
      campaign: campaign,
      marketing_channel: marketing_channel || campaign&.channel || "direct",
      location: location,
      answered: answered,
      outcome: outcome&.to_s,
      revenue_cents: revenue_cents,
      agent_id: answered ? "agent_01" : nil,
      source_updated_at: started_at + duration_seconds,
      local_date: local_date || started_at.in_time_zone(location.timezone).to_date
    )
  end

  private

  def resolve(value, klass)
    value.nil? || value.is_a?(klass) ? value : klass.find(value)
  end
end

RSpec.configure { |config| config.include MetricsData }
