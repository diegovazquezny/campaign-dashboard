require "rails_helper"

RSpec.describe Location do
  it "round-trips a text primary key" do
    Location.create!(id: "loc_01", name: "Northside Office", timezone: "America/New_York")
    expect(Location.find("loc_01")).to have_attributes(name: "Northside Office", timezone: "America/New_York")
  end

  it "requires a name and timezone" do
    expect(Location.new(id: "loc_01")).not_to be_valid
  end
end
