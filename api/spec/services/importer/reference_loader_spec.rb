require "rails_helper"
require "tmpdir"

RSpec.describe Importer::ReferenceLoader do
  let(:locations_csv) do
    "location_id,name,timezone\nloc_1,North,America/New_York\nloc_2,South,America/Phoenix\n"
  end
  let(:campaigns_csv) do
    "campaign_id,name,channel,daily_budget_usd\ncmp_1,Brand,paid_search,150.00\ncmp_2,Organic,organic,0\n"
  end

  around do |example|
    Dir.mktmpdir { |dir| @dir = dir; example.run }
  end

  def write(name, content)
    File.binwrite(File.join(@dir, name), content)
  end

  def load_files(locations: locations_csv, campaigns: campaigns_csv)
    write("locations.csv", locations)
    write("campaigns.csv", campaigns)
    described_class.new(@dir).call
  end

  it "loads valid rows" do
    result = load_files
    expect(result.location_ids).to eq(Set["loc_1", "loc_2"])
    expect(result.campaign_ids).to eq(Set["cmp_1", "cmp_2"])
    expect(result.locations.to_h).to include(rows: 2, inserted: 2, updated: 0, unchanged: 0, rejected: 0)
    expect(result.campaigns.to_h).to include(rows: 2, inserted: 2, updated: 0, unchanged: 0, rejected: 0)
    expect(result.rejections).to be_empty
    expect(Campaign.find("cmp_1")).to have_attributes(name: "Brand", channel: "paid_search", daily_budget_cents: 15_000)
    expect(Campaign.find("cmp_2").daily_budget_cents).to eq(0)
    expect(Location.find("loc_2").timezone).to eq("America/Phoenix")
  end

  it "reports nothing inserted or updated on a re-run and leaves rows untouched" do
    load_files
    before = Location.order(:id).pluck(:id, :updated_at) + Campaign.order(:id).pluck(:id, :updated_at)
    result = load_files
    expect(result.locations.to_h).to include(inserted: 0, updated: 0, unchanged: 2)
    expect(result.campaigns.to_h).to include(inserted: 0, updated: 0, unchanged: 2)
    expect(Location.order(:id).pluck(:id, :updated_at) + Campaign.order(:id).pluck(:id, :updated_at)).to eq(before)
  end

  it "counts a changed location name as an update" do
    load_files
    result = load_files(locations: locations_csv.sub("North", "Northside"))
    expect(result.locations.to_h).to include(inserted: 0, updated: 1, unchanged: 1)
    expect(Location.find("loc_1").name).to eq("Northside")
  end

  it "counts a changed timezone as an update" do
    load_files
    result = load_files(locations: locations_csv.sub("America/Phoenix", "America/Denver"))
    expect(result.locations.to_h).to include(updated: 1, unchanged: 1)
    expect(Location.find("loc_2").timezone).to eq("America/Denver")
  end

  it "counts a changed campaign budget as an update" do
    load_files
    result = load_files(campaigns: campaigns_csv.sub("150.00", "200.00"))
    expect(result.campaigns.to_h).to include(updated: 1, unchanged: 1)
    expect(Campaign.find("cmp_1").daily_budget_cents).to eq(20_000)
  end

  it "rejects an unknown timezone with its line number" do
    result = load_files(locations: locations_csv + "loc_3,West,Mars/Base\n")
    expect(result.rejections).to eq([ Importer::Rejection.new(file: "locations.csv", line: 4, reason: 'unknown timezone "Mars/Base"') ])
    expect(result.location_ids).to eq(Set["loc_1", "loc_2"])
    expect(result.locations.rejected).to eq(1)
    expect(Location.exists?("loc_3")).to be(false)
  end

  it "rejects an unknown channel" do
    result = load_files(campaigns: campaigns_csv + "cmp_3,Bad,telepathy,10.00\n")
    expect(result.rejections.map { |r| [ r.file, r.line, r.reason ] })
      .to eq([ [ "campaigns.csv", 4, 'unknown channel "telepathy"' ] ])
    expect(result.campaign_ids).not_to include("cmp_3")
  end

  [ "1e3", "NaN", "1.234", "-5", " 5" ].each do |bad|
    it "rejects budget #{bad.inspect}" do
      result = load_files(campaigns: campaigns_csv + "cmp_3,Bad,social,#{bad}\n")
      expect(result.rejections.size).to eq(1)
      expect(result.rejections.first.reason).to start_with("invalid daily_budget_usd")
      expect(result.rejections.first.line).to eq(4)
    end
  end

  it "rejects blank ids and names" do
    result = load_files(locations: locations_csv + ",NoId,America/Chicago\nloc_9,,America/Chicago\n")
    expect(result.rejections.map { |r| [ r.line, r.reason ] }).to eq([ [ 4, "blank location_id" ], [ 5, "blank name" ] ])
  end

  it "collapses identical duplicate ids" do
    result = load_files(locations: locations_csv + "loc_1,North,America/New_York\n")
    expect(result.rejections).to be_empty
    expect(result.locations.to_h).to include(rows: 3, inserted: 2, rejected: 0)
    expect(Location.count).to eq(2)
  end

  it "rejects both rows of conflicting duplicate ids" do
    result = load_files(locations: locations_csv + "loc_1,Other,America/New_York\n")
    expect(result.rejections.map { |r| [ r.line, r.reason ] }).to eq([ [ 2, "conflicting versions" ], [ 4, "conflicting versions" ] ])
    expect(result.location_ids).to eq(Set["loc_2"])
    expect(Location.exists?("loc_1")).to be(false)
  end

  it "rejects conflicting campaign ids" do
    result = load_files(campaigns: campaigns_csv + "cmp_1,Brand,paid_search,151.00\n")
    expect(result.rejections.map(&:reason)).to eq([ "conflicting versions" ] * 2)
    expect(result.campaign_ids).to eq(Set["cmp_2"])
  end

  it "raises Importer::Error for a missing file" do
    write("locations.csv", locations_csv)
    expect { described_class.new(@dir).call }.to raise_error(Importer::Error, /campaigns.csv/)
  end

  it "raises Importer::Error for a missing header column" do
    expect { load_files(locations: "location_id,name\nloc_1,North\n") }.to raise_error(Importer::Error, /locations.csv/)
  end

  it "raises Importer::Error for an extra header column" do
    expect { load_files(campaigns: "campaign_id,name,channel,daily_budget_usd,extra\n") }
      .to raise_error(Importer::Error, /campaigns.csv/)
  end

  it "raises Importer::Error for an empty file" do
    expect { load_files(locations: "") }.to raise_error(Importer::Error, /locations.csv/)
  end

  it "handles CRLF line endings without leaving carriage returns" do
    result = load_files(locations: locations_csv.gsub("\n", "\r\n"), campaigns: campaigns_csv.gsub("\n", "\r\n"))
    expect(result.rejections).to be_empty
    expect(Location.find("loc_2").timezone).to eq("America/Phoenix")
    expect(Campaign.find("cmp_2").daily_budget_cents).to eq(0)
  end

  it "loads header-only files" do
    result = load_files(locations: "location_id,name,timezone\n", campaigns: "campaign_id,name,channel,daily_budget_usd\n")
    expect(result.location_ids).to be_empty
    expect(result.locations.rows).to eq(0)
  end
end
