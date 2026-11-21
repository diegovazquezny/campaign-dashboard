require "rails_helper"

RSpec.describe Call do
  before do
    Campaign.create!(id: "cmp_01", name: "Search", channel: "paid_search", daily_budget_cents: 100)
    Location.create!(id: "loc_01", name: "Phoenix", timezone: "America/Phoenix")
  end

  def attrs(**over)
    {
      call_id: "call_1", started_at: Time.utc(2026, 1, 1, 12), ended_at: Time.utc(2026, 1, 1, 12, 5),
      duration_seconds: 300, caller_number_hash: "h1", tracking_number: "t1", campaign_id: "cmp_01",
      marketing_channel: "paid_search", location_id: "loc_01", answered: true, outcome: "booked",
      revenue_cents: 29_950, agent_id: "agt_1", source_updated_at: Time.utc(2026, 1, 1, 13),
      local_date: Date.new(2026, 1, 1)
    }.merge(over)
  end

  def unanswered(**over)
    attrs(answered: false, outcome: "missed", revenue_cents: nil, agent_id: nil, **over)
  end

  def expect_db_rejection(name, **over)
    expect { Call.insert!(attrs(**over)) }.to raise_error(ActiveRecord::StatementInvalid, /#{name}/)
  end

  it "inserts a valid booked call" do
    expect { Call.create!(attrs) }.not_to raise_error
    expect(Call.find("call_1")).to be_booked.and be_paid_search
  end

  it "inserts a valid unanswered call without campaign" do
    expect { Call.create!(unanswered(campaign_id: nil)) }.not_to raise_error
  end

  it "accepts an answered call awaiting outcome" do
    expect { Call.create!(attrs(outcome: nil, revenue_cents: nil)) }.not_to raise_error
  end

  it "defines enums from the shared constants" do
    expect(Call.outcomes.keys).to eq(Outcome::ALL)
    expect(Call.marketing_channels.keys).to eq(Channel::ALL)
  end

  it "does not shadow Object#display" do
    expect(Call.new(marketing_channel: "display")).to be_display
  end

  it "associates campaign and location" do
    call = Call.create!(attrs)
    expect(call.campaign).to eq(Campaign.find("cmp_01"))
    expect(Location.find("loc_01").calls).to contain_exactly(call)
  end

  describe "database constraints" do
    it "rejects negative duration" do
      expect_db_rejection("calls_duration_seconds_check", duration_seconds: -1)
    end

    it "rejects negative revenue" do
      expect_db_rejection("calls_revenue_cents_check", revenue_cents: -1)
    end

    it "rejects an unknown outcome" do
      expect_db_rejection("calls_(outcome|answered_rule)_check", outcome: "nope")
    end

    it "rejects an unknown marketing channel" do
      expect_db_rejection("calls_marketing_channel_check", marketing_channel: "radio")
    end

    it "rejects unanswered with an agent" do
      expect_db_rejection("calls_unanswered_rule_check", **unanswered(agent_id: "agt_1"))
    end

    it "rejects unanswered with a non-missed/voicemail outcome" do
      expect_db_rejection("calls_unanswered_rule_check", **unanswered(outcome: "qualified_lead"))
    end

    it "rejects unanswered with a blank outcome" do
      expect_db_rejection("calls_unanswered_rule_check", **unanswered(outcome: nil))
    end

    it "rejects answered without an agent" do
      expect_db_rejection("calls_answered_rule_check", agent_id: nil)
    end

    it "rejects answered with a missed outcome" do
      expect_db_rejection("calls_answered_rule_check", outcome: "missed", revenue_cents: nil)
    end

    it "rejects revenue without a booked outcome" do
      expect_db_rejection("calls_revenue_booked_rule_check", outcome: "qualified_lead")
    end

    it "rejects booked without revenue" do
      expect_db_rejection("calls_revenue_booked_rule_check", revenue_cents: nil)
    end

    it "rejects ended_at before started_at" do
      expect_db_rejection("calls_ended_after_started_check", ended_at: Time.utc(2026, 1, 1, 11))
    end

    it "rejects an unknown campaign" do
      expect { Call.insert!(attrs(campaign_id: "cmp_x")) }.to raise_error(ActiveRecord::InvalidForeignKey)
    end

    it "rejects an unknown location" do
      expect { Call.insert!(attrs(location_id: "loc_x")) }.to raise_error(ActiveRecord::InvalidForeignKey)
    end
  end

  describe "indexes" do
    it "has the planned indexes" do
      conn = ActiveRecord::Base.connection
      [ %w[local_date], %w[campaign_id local_date], %w[location_id local_date],
        %w[caller_number_hash started_at call_id] ].each do |cols|
        expect(conn.index_exists?(:calls, cols)).to be(true), "missing index #{cols}"
      end
    end
  end

  it "keeps the DB check constraints in sync with the shared constants" do
    defs = ActiveRecord::Base.connection.check_constraints(:calls).to_h { |c| [ c.name, c.expression ] }
    Channel::ALL.each { |v| expect(defs["calls_marketing_channel_check"]).to include("'#{v}'") }
    Outcome::ALL.each { |v| expect(defs["calls_outcome_check"]).to include("'#{v}'") }
  end
end
