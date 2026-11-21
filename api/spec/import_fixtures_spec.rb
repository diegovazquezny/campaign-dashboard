require "rails_helper"

RSpec.describe "import fixtures" do
  calls_header = %w[call_id started_at ended_at duration_seconds caller_number_hash tracking_number
                    campaign_id marketing_channel location_id answered outcome revenue_usd agent_id updated_at]
  locations_header = %w[location_id name timezone]
  campaigns_header = %w[campaign_id name channel daily_budget_usd]

  # [scenario, file, header, data row count]
  expected = [
    [ nil, "locations.csv", locations_header, 3 ],
    [ nil, "campaigns.csv", campaigns_header, 3 ],
    [ nil, "calls.csv", calls_header, 12 ],
    [ "rejects", "calls.csv", calls_header, 28 ],
    [ "out_of_order", "calls.csv", calls_header, 3 ],
    [ "conflicting", "calls.csv", calls_header, 4 ],
    [ "newest_invalid", "calls.csv", calls_header, 2 ],
    [ "bad_references", "locations.csv", locations_header, 6 ],
    [ "bad_references", "campaigns.csv", campaigns_header, 5 ],
    [ "bad_references", "calls.csv", calls_header, 6 ],
    [ "crlf", "calls.csv", calls_header, 2 ]
  ]

  expected.each do |scenario, file, header, count|
    it "#{[ scenario, file ].compact.join('/')} parses with #{count} rows and the expected headers" do
      path = ImportFixtures::IMPORT_FIXTURE_ROOT.join(*[ scenario, file ].compact)
      table = CSV.read(path, headers: true)
      expect(table.headers).to eq(header)
      expect(table.size).to eq(count)
    end
  end

  it "uses CRLF line endings only in crlf/" do
    root = ImportFixtures::IMPORT_FIXTURE_ROOT
    crlf, others = root.glob("**/*.csv").partition { |f| f.to_s.include?("/crlf/") }
    expect(crlf).not_to be_empty
    expect(crlf.map { |f| File.binread(f) }).to all(include("\r\n"))
    expect(others.map { |f| File.binread(f) }).to all(satisfy { |c| !c.include?("\r") })
  end

  describe "#with_import_dir" do
    it "yields the base set, and a scenario overrides only its own files" do
      with_import_dir("bad_references") do |dir|
        expect(Dir.children(dir)).to contain_exactly("locations.csv", "campaigns.csv", "calls.csv")
        expect(CSV.read(File.join(dir, "calls.csv"), headers: true).size).to eq(6)
      end
      with_import_dir("rejects") do |dir|
        expect(CSV.read(File.join(dir, "locations.csv"), headers: true).size).to eq(3)
        expect(CSV.read(File.join(dir, "calls.csv"), headers: true).size).to eq(28)
      end
    end

    it "removes the directory afterwards and rejects unknown scenarios" do
      kept = nil
      with_import_dir { |dir| kept = dir }
      expect(File.exist?(kept)).to be(false)
      expect { with_import_dir("nope") { } }.to raise_error(ArgumentError, /nope/)
    end
  end
end
