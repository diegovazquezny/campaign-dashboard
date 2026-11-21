require "rails_helper"

RSpec.describe CleanDatabase do
  it "refuses to delete anything outside the test environment" do
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new("development"))
    Location.create!(id: "loc_guard", name: "N", timezone: "America/New_York")

    expect { described_class.wipe! }.to raise_error(/Refusing to delete data.*development/)
    expect(Location.exists?("loc_guard")).to be(true)
  end

  it "deletes rows in the test environment" do
    Location.create!(id: "loc_guard", name: "N", timezone: "America/New_York")
    described_class.wipe!
    expect(Location.count).to eq(0)
  end
end
