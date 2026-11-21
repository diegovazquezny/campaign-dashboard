require "rails_helper"

# Imports the real CSVs in data/ (about 5k rows, fast). Non-transactional so the
# import really commits; tables are truncated afterwards.
RSpec.describe "Importing the real data", :real_data do
  self.use_transactional_tests = false

  before { [ Call, Campaign, Location ].each(&:delete_all) }
  after { [ Call, Campaign, Location ].each(&:delete_all) }

  let(:data_dir) { Rails.root.join("..", "data").to_s }

  it "loads 5,411 rows as 5,000 calls with nothing rejected, and is idempotent" do
    result = Importer.run(data_dir: data_dir)
    expect(result.summary).to include("5,411 rows → 5,000 calls (411 older versions dropped, 0 rejected; 5,000 inserted, 0 updated, 0 local dates recomputed)")
    expect(result.rejections).to be_empty
    expect([ Location.count, Campaign.count, Call.count ]).to eq([ 8, 12, 5_000 ])

    again = Importer.run(data_dir: data_dir)
    expect(again.summary).to include("0 inserted, 0 updated, 0 local dates recomputed")
  end
end
