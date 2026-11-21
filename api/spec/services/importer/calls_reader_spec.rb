require "rails_helper"
require "tmpdir"

RSpec.describe Importer::CallsReader do
  let(:header) { Importer::CallsReader::HEADERS.join(",") }

  def line(call_id: "c_1", updated_at: "2026-09-01T10:02:00Z", revenue: "299.50", agent: "agt_1")
    [ call_id, "2026-09-01T10:00:00Z", "2026-09-01T10:01:40Z", "100", "h_1", "+1-555-0100", "cmp_01",
      "paid_search", "loc_01", "true", "booked", revenue, agent, updated_at ].join(",")
  end

  def read(*lines, eol: "\n", header_line: header)
    Dir.mktmpdir do |dir|
      path = File.join(dir, "calls.csv")
      File.write(path, ([ header_line ] + lines).join(eol) + eol)
      described_class.new(path, location_ids: Set["loc_01"], campaign_ids: Set["cmp_01"]).call
    end
  end

  it "returns valid rows with physical line numbers and counts" do
    result = read(line(call_id: "c_1"), line(call_id: "c_2"))
    expect(result.rows.map(&:line)).to eq([ 2, 3 ])
    expect(result.rows.first.attributes).to include(call_id: "c_1", revenue_cents: 29_950)
    expect(result).to have_attributes(rows_read: 2, duplicates_collapsed: 0, rejections: [])
  end

  it "rejects rows with extra fields instead of silently dropping them" do
    result = read(line(call_id: "c_1") + ",junk", line(call_id: "c_2"))
    expect(result.rows.map(&:line)).to eq([ 3 ])
    expect(result.rejections.map { |r| [ r.line, r.reason ] }).to eq([ [ 2, "expected 14 fields, got 15" ] ])
  end

  it "rejects a short row with a field-count reason" do
    result = read("c_1,2026-09-01T10:00:00Z")
    expect(result.rejections.map(&:reason)).to eq([ "expected 14 fields, got 2" ])
  end

  it "rejects a blank line and counts it as a row" do
    result = read(line(call_id: "c_1"), "", line(call_id: "c_2"))
    expect(result.rows.map(&:line)).to eq([ 2, 4 ])
    expect(result.rows_read).to eq(3)
    expect(result.rejections.map { |r| [ r.line, r.reason ] }).to eq([ [ 3, "expected 14 fields, got 0" ] ])
  end

  it "reports rejections with their line number" do
    result = read(line, line(call_id: "c_2", revenue: ""))
    expect(result.rows.size).to eq(1)
    expect(result.rejections).to eq([
      Importer::Rejection.new(file: "calls.csv", line: 3, reason: "booked call has no revenue")
    ])
    expect(result.rows_read).to eq(2)
  end

  it "keeps different versions of one call (different updated_at)" do
    result = read(line, line(updated_at: "2026-09-02T10:00:00Z"))
    expect(result.rows.size).to eq(2)
    expect(result.rejections).to be_empty
  end

  it "collapses exact duplicates" do
    result = read(line, line)
    expect(result.rows.map(&:line)).to eq([ 2 ])
    expect(result).to have_attributes(duplicates_collapsed: 1, rejections: [])
  end

  it "rejects both rows of a conflicting duplicate" do
    result = read(line, line(revenue: "100"))
    expect(result.rows).to be_empty
    expect(result.rejections).to eq([
      Importer::Rejection.new(file: "calls.csv", line: 2, reason: "conflicting versions"),
      Importer::Rejection.new(file: "calls.csv", line: 3, reason: "conflicting versions")
    ])
  end

  it "detects conflicts far apart in the file and rejects every repeat" do
    filler = (1..50).map { |i| line(call_id: "f_#{i}") }
    result = read(line, *filler, line(revenue: "100"), line)
    expect(result.rejections.map(&:line)).to eq([ 2, 53, 54 ])
    expect(result.rows.size).to eq(50)
  end

  it "does not let an invalid row conflict with a valid one" do
    result = read(line, line(revenue: "bad"))
    expect(result.rows.size).to eq(1)
    expect(result.rejections.map(&:reason)).to eq([ 'revenue_usd: invalid amount "bad"' ])
  end

  it "handles CRLF line endings" do
    result = read(line, line(call_id: "c_2"), eol: "\r\n")
    expect(result.rejections).to be_empty
    expect(result.rows.map { |r| r.attributes[:source_updated_at] }).to all(eq(Time.utc(2026, 9, 1, 10, 2)))
  end

  it "raises Importer::Error for a missing file" do
    reader = described_class.new("/nonexistent/calls.csv", location_ids: Set.new, campaign_ids: Set.new)
    expect { reader.call }.to raise_error(Importer::Error, /file not found/)
  end

  it "raises Importer::Error for a missing header column" do
    expect { read(line, header_line: header.sub(",agent_id", "")) }
      .to raise_error(Importer::Error, /missing: agent_id/)
  end

  it "raises Importer::Error for an extra header column" do
    expect { read(line, header_line: "#{header},extra") }.to raise_error(Importer::Error, /extra: extra/)
  end
end
