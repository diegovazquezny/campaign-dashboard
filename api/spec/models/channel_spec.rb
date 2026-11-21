require "rails_helper"

RSpec.describe Channel do
  it "lists the six channels" do
    expect(Channel::ALL).to eq(%w[paid_search social display organic direct referral])
  end

  it "matches the values in the campaigns check constraint" do
    definition = ActiveRecord::Base.connection.check_constraints(:campaigns)
      .find { |c| c.name == "campaigns_channel_check" }.expression
    expect(definition.scan(/'([a-z_]+)'/).flatten).to match_array(Channel::ALL)
  end
end
