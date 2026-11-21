require "rails_helper"

RSpec.describe Outcome do
  it "lists the five outcomes" do
    expect(Outcome::ALL).to eq(%w[booked qualified_lead not_qualified missed voicemail])
  end
end
