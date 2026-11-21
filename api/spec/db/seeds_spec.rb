require "rails_helper"

RSpec.describe "db/seeds.rb" do
  let(:seeds) { Rails.root.join("db/seeds.rb") }
  let(:result) { instance_double(Importer::Result, summary: "SUMMARY") }

  def load_seeds
    load seeds
  end

  def create_call
    Location.create!(id: "loc_01", name: "N", timezone: "America/New_York")
    Call.create!(call_id: "c_1", started_at: Time.utc(2026, 9, 1, 10), ended_at: Time.utc(2026, 9, 1, 10, 1),
                 duration_seconds: 60, caller_number_hash: "h", tracking_number: "t", marketing_channel: "direct",
                 location_id: "loc_01", answered: false, outcome: "missed", source_updated_at: Time.utc(2026, 9, 1, 10, 2),
                 local_date: Date.new(2026, 9, 1))
  end

  it "runs the import and prints its summary when calls is empty" do
    allow(Importer).to receive(:run).and_return(result)
    expect { load_seeds }.to output("SUMMARY\n").to_stdout
    expect(Importer).to have_received(:run).once
  end

  it "does not import when calls already has data" do
    create_call
    allow(Importer).to receive(:run)
    expect { load_seeds }.not_to output.to_stdout
    expect(Importer).not_to have_received(:run)
  end

  describe "after a failed first import" do
    around do |example|
      old = ENV["DATA_DIR"]
      Dir.mktmpdir do |empty_dir|
        ENV["DATA_DIR"] = empty_dir
        example.run
      end
    ensure
      ENV["DATA_DIR"] = old
    end

    it "leaves calls empty so the next start retries and succeeds" do
      expect { load_seeds }.to raise_error(Importer::Error)
      expect([ Location.count, Campaign.count, Call.count ]).to eq([ 0, 0, 0 ])

      with_import_dir do |dir|
        ENV["DATA_DIR"] = dir
        expect { load_seeds }.to output(/calls\.csv: 12 rows → 8 calls/).to_stdout
      end
      expect(Call.count).to eq(8)
    end
  end
end
