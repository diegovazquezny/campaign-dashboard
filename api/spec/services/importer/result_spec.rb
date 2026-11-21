require "rails_helper"

RSpec.describe Importer::Result do
  def run(*scenarios)
    with_import_dir(*scenarios) { |dir| Importer.run(data_dir: dir) }
  end

  it "summarizes the base fixture run" do
    expect(run.summary).to eq(<<~TEXT.chomp)
      locations.csv: 3 loaded, 0 rejected
      campaigns.csv: 3 loaded, 0 rejected
      calls.csv: 12 rows → 8 calls (4 older versions dropped, 0 rejected; 8 inserted, 0 updated, 0 local dates recomputed)
    TEXT
  end

  it "reports no inserts or updates on a re-run" do
    run
    expect(run.summary).to include("8 calls (4 older versions dropped, 0 rejected; 0 inserted, 0 updated, 0 local dates recomputed)")
  end

  it "lists rejections with file, line and reason, and notes collapsed duplicates" do
    summary = run("rejects").summary
    expect(summary).to include("calls.csv: 28 rows → 1 calls (0 older versions dropped, 26 rejected; 1 inserted")
    expect(summary).to include("1 exact duplicate rows collapsed")
    expect(summary.lines.count { |l| l.start_with?("  calls.csv:") }).to eq(26)
    expect(summary).to match(/^  calls\.csv:\d+: .+/)
  end

  it "lists reference-file rejections with their file name" do
    run
    summary = run("bad_references").summary
    expect(summary).to include("locations.csv: 2 loaded, 3 rejected", "campaigns.csv: 2 loaded, 3 rejected")
    expect(summary).to match(/^  locations\.csv:\d+: conflicting versions/)
    expect(summary).to match(/^  campaigns\.csv:\d+: unknown channel "tv"/)
  end

  it "caps the listing at 100 rejections and says how many were hidden" do
    rejections = Array.new(105) { |i| Importer::Rejection.new(file: "calls.csv", line: i + 2, reason: "bad") }
    counts = Importer::ReferenceLoader::Counts.new(rows: 0, inserted: 0, updated: 0, unchanged: 0, rejected: 0)
    result = described_class.new(locations: counts, campaigns: counts, rows: 105, rejected: 105, calls: 0,
                                 older_versions_dropped: 0, duplicates_collapsed: 0, inserted: 0, updated: 0,
                                 local_dates_recomputed: 0, rejections: rejections)
    lines = result.summary.lines.map(&:chomp)
    expect(lines.count { |l| l.start_with?("  calls.csv:") }).to eq(100)
    expect(lines.last).to eq("  … and 5 more rejected rows")
  end

  it "formats large numbers with thousands separators" do
    counts = Importer::ReferenceLoader::Counts.new(rows: 0, inserted: 0, updated: 0, unchanged: 0, rejected: 0)
    result = described_class.new(locations: counts, campaigns: counts, rows: 5411, rejected: 0, calls: 5000,
                                 older_versions_dropped: 411, duplicates_collapsed: 0, inserted: 5000, updated: 0,
                                 local_dates_recomputed: 0, rejections: [])
    expect(result.summary).to include("calls.csv: 5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected; 5,000 inserted")
  end
end
