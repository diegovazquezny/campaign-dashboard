require "rails_helper"

RSpec.describe Importer::CallRowValidator do
  subject(:validator) do
    described_class.new(location_ids: Set["loc_01"], campaign_ids: Set["cmp_01"])
  end

  let(:answered_row) do
    {
      "call_id" => "c_1", "started_at" => "2026-09-01T10:00:00Z", "ended_at" => "2026-09-01T10:01:40Z",
      "duration_seconds" => "100", "caller_number_hash" => "h_1", "tracking_number" => "+1-555-0100",
      "campaign_id" => "cmp_01", "marketing_channel" => "paid_search", "location_id" => "loc_01",
      "answered" => "true", "outcome" => "booked", "revenue_usd" => "299.50", "agent_id" => "agt_1",
      "updated_at" => "2026-09-01T10:02:00Z"
    }
  end
  let(:missed_row) do
    answered_row.merge("answered" => "false", "outcome" => "missed", "revenue_usd" => "", "agent_id" => "")
  end

  def reason_for(overrides, base = answered_row)
    result = validator.call(base.merge(overrides), 7)
    expect(result).to be_a(Importer::Rejection)
    expect(result.line).to eq(7)
    expect(result.file).to eq("calls.csv")
    result.reason
  end

  it "normalizes a valid answered booked row" do
    expect(validator.call(answered_row, 2)).to eq(
      call_id: "c_1", started_at: Time.utc(2026, 9, 1, 10), ended_at: Time.utc(2026, 9, 1, 10, 1, 40),
      source_updated_at: Time.utc(2026, 9, 1, 10, 2), duration_seconds: 100, caller_number_hash: "h_1",
      tracking_number: "+1-555-0100", campaign_id: "cmp_01", marketing_channel: "paid_search",
      location_id: "loc_01", answered: true, outcome: "booked", revenue_cents: 29_950, agent_id: "agt_1"
    )
  end

  it "normalizes a valid unanswered row, blanks to nil" do
    attrs = validator.call(missed_row, 2)
    expect(attrs).to include(answered: false, outcome: "missed", revenue_cents: nil, agent_id: nil)
  end

  it "accepts a blank campaign_id and a blank outcome on an answered call" do
    attrs = validator.call(answered_row.merge("campaign_id" => "", "outcome" => "", "revenue_usd" => ""), 2)
    expect(attrs).to include(campaign_id: nil, outcome: nil)
  end

  it "returns UTC Time values" do
    expect(validator.call(answered_row, 2)[:started_at]).to be_utc
  end

  %w[call_id caller_number_hash tracking_number started_at ended_at location_id marketing_channel updated_at].each do |f|
    it "rejects blank #{f}" do
      expect(reason_for(f => "")).to eq("#{f} is blank")
    end
  end

  describe "strict parsing" do
    it "rejects a timestamp with an offset" do
      expect(reason_for("started_at" => "2026-09-01T10:00:00+00:00")).to eq(
        'started_at: invalid timestamp "2026-09-01T10:00:00+00:00"'
      )
    end

    it "rejects an impossible timestamp" do
      expect(reason_for("ended_at" => "2026-13-01T10:00:00Z")).to eq('ended_at: invalid timestamp "2026-13-01T10:00:00Z"')
    end

    it "rejects a bad updated_at" do
      expect(reason_for("updated_at" => "yesterday")).to eq('updated_at: invalid timestamp "yesterday"')
    end

    it "rejects a non-integer duration" do
      expect(reason_for("duration_seconds" => "1_0")).to eq('duration_seconds: invalid integer "1_0"')
    end

    it "rejects a negative duration" do
      expect(reason_for("duration_seconds" => "-5")).to eq('duration_seconds: invalid integer "-5"')
    end

    it "rejects an out-of-range duration" do
      expect(reason_for("duration_seconds" => "2147483648")).to eq('duration_seconds: integer out of range "2147483648"')
    end

    it "rejects a bad boolean" do
      expect(reason_for("answered" => "yes")).to eq('answered: invalid boolean "yes"')
    end

    %w[1e3 NaN 1.234 -5 \ 5].each do |bad|
      it "rejects revenue #{bad.inspect}" do
        expect(reason_for("revenue_usd" => bad)).to eq("revenue_usd: invalid amount #{bad.inspect}")
      end
    end

    it "rejects out-of-range revenue" do
      expect(reason_for("revenue_usd" => "99999999999")).to eq('revenue_usd: amount out of range "99999999999"')
    end

    it "converts whole-dollar revenue" do
      expect(validator.call(answered_row.merge("revenue_usd" => "89"), 2)[:revenue_cents]).to eq(8900)
    end
  end

  describe "enums" do
    it "rejects an unknown channel" do
      expect(reason_for("marketing_channel" => "radio")).to eq('marketing_channel: unknown value "radio"')
    end

    it "rejects an unknown outcome" do
      expect(reason_for("outcome" => "won")).to eq('outcome: unknown value "won"')
    end
  end

  describe "field rules" do
    it "rejects an unanswered call with an agent" do
      expect(reason_for({ "agent_id" => "agt_1" }, missed_row)).to eq("unanswered call has an agent_id")
    end

    it "rejects an unanswered call with a non-missed outcome" do
      expect(reason_for({ "outcome" => "qualified_lead" }, missed_row)).to eq(
        "unanswered call must have outcome missed or voicemail"
      )
    end

    it "rejects an unanswered call with a blank outcome" do
      expect(reason_for({ "outcome" => "" }, missed_row)).to eq("unanswered call must have outcome missed or voicemail")
    end

    it "rejects an unanswered call with revenue" do
      expect(reason_for({ "revenue_usd" => "10" }, missed_row)).to eq("revenue present without outcome booked")
    end

    it "rejects an answered call without an agent" do
      expect(reason_for("agent_id" => "")).to eq("answered call has no agent_id")
    end

    it "rejects an answered call with outcome missed" do
      expect(reason_for("outcome" => "missed", "revenue_usd" => "")).to eq("answered call has outcome missed")
    end

    it "rejects revenue without booked" do
      expect(reason_for("outcome" => "qualified_lead")).to eq("revenue present without outcome booked")
    end

    it "rejects booked without revenue" do
      expect(reason_for("revenue_usd" => "")).to eq("booked call has no revenue")
    end

    it "rejects ended_at before started_at" do
      expect(reason_for("ended_at" => "2026-09-01T09:59:00Z")).to eq("ended_at is before started_at")
    end

    it "rejects a duration mismatch" do
      expect(reason_for("duration_seconds" => "99")).to eq(
        "duration_seconds 99 does not match ended_at - started_at (100)"
      )
    end
  end

  describe "references" do
    it "rejects an unknown location" do
      expect(reason_for("location_id" => "loc_99")).to eq('unknown location_id "loc_99"')
    end

    it "rejects an unknown campaign" do
      expect(reason_for("campaign_id" => "cmp_99")).to eq('unknown campaign_id "cmp_99"')
    end
  end
end
