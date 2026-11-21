require "rails_helper"

RSpec.describe "Importer.run" do
  def run(*scenarios)
    with_import_dir(*scenarios) { |dir| Importer.run(data_dir: dir) }
  end

  def snapshot
    Call.order(:call_id).map { |c| c.attributes.except("created_at", "updated_at") }
  end

  it "imports the base set" do
    result = run
    expect(result).to have_attributes(rows: 12, rejected: 0, calls: 8, older_versions_dropped: 4,
                                      duplicates_collapsed: 0, inserted: 8, updated: 0, rejections: [])
    expect(result.locations.inserted).to eq(3)
    expect(result.campaigns.inserted).to eq(3)
    expect(Call.count).to eq(8)
  end

  it "keeps the latest version, including a late booked outcome" do
    run
    expect(Call.find("c_001")).to have_attributes(
      outcome: "booked", revenue_cents: 29_950, source_updated_at: Time.utc(2026, 9, 3, 10, 5)
    )
    expect(Call.find("c_002")).to have_attributes(outcome: "qualified_lead", source_updated_at: Time.utc(2026, 9, 1, 11, 20))
    expect(Call.find("c_003")).to have_attributes(outcome: "booked", revenue_cents: 12_000)
  end

  it "chooses the latest version by updated_at even when the file lists it first" do
    result = run("out_of_order")
    expect(result).to have_attributes(rows: 3, calls: 1, older_versions_dropped: 2, rejected: 0)
    expect(Call.find("c_001")).to have_attributes(outcome: "booked", revenue_cents: 29_950,
                                                  source_updated_at: Time.utc(2026, 9, 3, 10, 5))
  end

  it "buckets a call crossing UTC midnight on the office's local date (Phoenix vs Denver)" do
    run
    expect(Call.find("c_004").local_date).to eq(Date.new(2026, 8, 31))
    expect(Call.find("c_005").local_date).to eq(Date.new(2026, 9, 1))
  end

  describe "re-importing" do
    it "changes nothing, not even updated_at" do
      run
      before = Call.order(:call_id).pluck(:call_id, :created_at, :updated_at)
      result = run
      expect(result).to have_attributes(inserted: 0, updated: 0, calls: 8)
      expect(result.locations).to have_attributes(inserted: 0, updated: 0)
      expect(result.campaigns).to have_attributes(inserted: 0, updated: 0)
      expect(Call.order(:call_id).pluck(:call_id, :created_at, :updated_at)).to eq(before)
    end

    it "gives the same calls as importing into an empty database" do
      run
      first = snapshot
      run
      expect(snapshot).to eq(first)
      Call.delete_all
      run
      expect(snapshot).to eq(first)
    end

    it "works twice in one example (staging table is re-created)" do
      expect { 2.times { run } }.not_to raise_error
    end

    it "does not let an older file overwrite a newer stored version" do
      run
      result = run("out_of_order")
      expect(result).to have_attributes(inserted: 0, updated: 0)
      expect(Call.find("c_001").source_updated_at).to eq(Time.utc(2026, 9, 3, 10, 5))
    end

    it "updates only the call that has a strictly newer version" do
      run
      before = Call.order(:call_id).index_by(&:call_id)
      newer = "c_008,2026-09-01T15:00:00Z,2026-09-01T15:02:00Z,120,h_a8,+1-555-0100,cmp_01," \
              "paid_search,loc_01,true,booked,50.00,agt_08,2026-09-02T15:00:00Z\n"

      result = with_import_dir do |dir|
        File.open(File.join(dir, "calls.csv"), "a") { |f| f.write(newer) }
        Importer.run(data_dir: dir)
      end

      expect(result).to have_attributes(inserted: 0, updated: 1, rows: 13, older_versions_dropped: 5)
      call = Call.find("c_008")
      expect(call).to have_attributes(outcome: "booked", revenue_cents: 5_000,
                                      source_updated_at: Time.utc(2026, 9, 2, 15))
      expect(call.created_at).to eq(before["c_008"].created_at)
      expect(call.updated_at).to be > before["c_008"].updated_at
      untouched = Call.where.not(call_id: "c_008").order(:call_id).pluck(:call_id, :updated_at)
      expect(untouched).to eq(before.except("c_008").values.map { |c| [ c.call_id, c.updated_at ] })
    end
  end

  describe "rejections" do
    it "lists every rejected row and still imports the valid ones" do
      result = run("rejects")
      expect(result).to have_attributes(rows: 28, rejected: 26, calls: 1, duplicates_collapsed: 1,
                                        older_versions_dropped: 0, inserted: 1)
      expect(result.rejections.size).to eq(26)
      expect(result.rejections).to all(have_attributes(file: "calls.csv", reason: be_present))
      expect(Call.pluck(:call_id)).to eq([ "r_exact_dup" ])
    end

    it "rejects both rows of a conflicting version and keeps the rest" do
      result = run("conflicting")
      expect(result).to have_attributes(rows: 4, rejected: 2, calls: 2, inserted: 2)
      expect(Call.pluck(:call_id)).to contain_exactly("c_after_conflict", "c_between")
    end

    it "leaves a call at its older valid version when the newest is rejected" do
      result = run("newest_invalid")
      expect(result).to have_attributes(rejected: 1, calls: 1, inserted: 1)
      expect(Call.find("c_newest_bad")).to have_attributes(outcome: nil, revenue_cents: nil)
    end

    it "rejects only the calls whose location or campaign was rejected, and keeps existing rows" do
      run
      result = run("bad_references")
      expect(result).to have_attributes(rows: 6, rejected: 4, calls: 2, inserted: 2)
      expect(result.rejections.group_by(&:file).transform_values(&:size)).to eq(
        "locations.csv" => 3, "campaigns.csv" => 3, "calls.csv" => 4
      )
      expect(Call.pluck(:call_id)).to include("c_004", "c_005", "c_007", "b_ok_loc_01", "b_ok_loc_08")
      expect(Call.count).to eq(10)
      expect(Location.find("loc_05").name).to eq("Mesa Ridge Office")
    end
  end

  it "reads CRLF files with physical line numbers" do
    result = run("crlf")
    expect(result).to have_attributes(rows: 2, rejected: 0, calls: 2, inserted: 2)
  end

  it "rolls back locations and campaigns when calls.csv cannot be read" do
    with_import_dir do |dir|
      File.delete(File.join(dir, "calls.csv"))
      expect { Importer.run(data_dir: dir) }.to raise_error(Importer::Error, /calls.csv/)
    end
    expect([ Location.count, Campaign.count, Call.count ]).to eq([ 0, 0, 0 ])
  end
end

RSpec.describe "Importer.run local dates and rollback" do
  def run(*scenarios)
    with_import_dir(*scenarios) { |dir| Importer.run(data_dir: dir) }
  end

  describe "stale local_date" do
    def run_with_timezone(zone)
      with_import_dir do |dir|
        path = File.join(dir, "locations.csv")
        File.write(path, File.read(path).sub("America/Phoenix", zone))
        Importer.run(data_dir: dir)
      end
    end

    it "recomputes local dates for existing calls when a location's timezone changes" do
      expect(run.local_dates_recomputed).to eq(0)
      expect(Call.find("c_004").local_date).to eq(Date.new(2026, 8, 31)) # Phoenix, 23:30 on Aug 31
      updated_before = Call.pluck(:call_id, :updated_at).to_h

      result = run_with_timezone("America/Denver") # same instant is 00:30 on Sep 1 in Denver

      expect(result).to have_attributes(local_dates_recomputed: 1, inserted: 0, updated: 0)
      expect(result.locations.updated).to eq(1)
      expect(Call.find("c_004").local_date).to eq(Date.new(2026, 9, 1))
      expect(Call.find("c_005").local_date).to eq(Date.new(2026, 9, 1))
      expect(Call.find("c_004").updated_at).to be > updated_before["c_004"]
      expect(Call.where.not(call_id: "c_004").pluck(:call_id, :updated_at).to_h)
        .to eq(updated_before.except("c_004"))
    end

    it "reports 0 recomputed on a re-run" do
      run
      run_with_timezone("America/Denver")
      expect(run_with_timezone("America/Denver").local_dates_recomputed).to eq(0)
    end
  end

  describe "rollback", :aggregate_failures do
    # Needs real commits/rollbacks, so no wrapping transaction.
    self.use_transactional_tests = false

    # Clean before as well as after, so rows leaked by an aborted example
    # can't break the next one.
    before { [ Call, Campaign, Location ].each(&:delete_all) }
    after { [ Call, Campaign, Location ].each(&:delete_all) }

    def counts = [ Location.count, Campaign.count, Call.count ]

    it "leaves everything untouched when a failure follows the reference load" do
      allow_any_instance_of(Importer::CallsReader).to receive(:call).and_raise("boom")
      expect { run }.to raise_error("boom")
      expect(counts).to eq([ 0, 0, 0 ])
    end

    it "leaves everything untouched when a failure follows the calls upsert" do
      allow_any_instance_of(Importer::CallsWriter).to receive(:recompute_local_dates).and_raise("boom")
      expect { run }.to raise_error("boom")
      expect(counts).to eq([ 0, 0, 0 ])
    end

    it "restores previously imported data when a failure follows the real recompute" do
      run
      before = [ Location.pluck(:id, :timezone, :updated_at),
                 Call.order(:call_id).pluck(:call_id, :local_date, :updated_at) ]
      # build_result runs after the upsert and the recompute, so by now c_004's
      # local_date has really been rewritten inside the transaction.
      allow_any_instance_of(Importer::Runner).to receive(:build_result).and_raise("boom")

      expect do
        with_import_dir do |dir|
          path = File.join(dir, "locations.csv")
          File.write(path, File.read(path).sub("America/Phoenix", "America/Denver"))
          Importer.run(data_dir: dir)
        end
      end.to raise_error("boom")

      expect(Call.find("c_004").local_date).to eq(Date.new(2026, 8, 31))
      expect(Location.pluck(:id, :timezone, :updated_at)).to eq(before.first)
      expect(Call.order(:call_id).pluck(:call_id, :local_date, :updated_at)).to eq(before.last)
    end
  end
end
