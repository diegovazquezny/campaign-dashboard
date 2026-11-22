require "rails_helper"

RSpec.describe Metrics::EarlierCallProbe do
  def first_call_flags(call_alias = "c")
    sql = "SELECT c.call_id, (#{described_class.no_earlier_call_sql(call_alias)}) AS first_call FROM calls c"
    ActiveRecord::Base.connection.select_all(sql).to_h { |r| [ r["call_id"], r["first_call"] ] }
  end

  it "is true only for a caller's earliest call, ignoring every filter" do
    build_call(id: "a1", caller_number: "a", started_at: Time.utc(2026, 8, 1, 15), campaign: nil)
    build_call(id: "a2", caller_number: "a", started_at: Time.utc(2026, 9, 1, 15))
    build_call(id: "b1", caller_number: "b", started_at: Time.utc(2026, 9, 1, 15))

    expect(first_call_flags).to eq("a1" => true, "a2" => false, "b1" => true)
  end

  it "breaks started_at ties by call_id" do
    build_call(id: "t1", caller_number: "a", started_at: Time.utc(2026, 9, 1, 15))
    build_call(id: "t2", caller_number: "a", started_at: Time.utc(2026, 9, 1, 15))

    expect(first_call_flags).to eq("t1" => true, "t2" => false)
  end

  it "uses the given table alias" do
    build_call(id: "x", caller_number: "a")

    sql = "SELECT (#{described_class.no_earlier_call_sql('k')}) AS first_call FROM calls k"
    expect(ActiveRecord::Base.connection.select_value(sql)).to be(true)
  end
end
