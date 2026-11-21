require "rails_helper"
require Rails.root.join("lib/scale_check")

RSpec.describe ScaleCheck do
  it "derives the scratch database name from the configured one" do
    expect(described_class.scratch_name("campaign_dashboard_development", rails_env: "development"))
      .to eq("campaign_dashboard_development_scale_check")
  end

  it "refuses production, blank names and names that are already scratch" do
    expect { described_class.scratch_name("db", rails_env: "production") }.to raise_error(ScaleCheck::Refused)
    expect { described_class.scratch_name("", rails_env: "development") }.to raise_error(ScaleCheck::Refused)
    expect { described_class.scratch_name("x_scale_check", rails_env: "development") }.to raise_error(ScaleCheck::Refused)
  end

  it "only accepts scratch database names" do
    expect { described_class.assert_scratch!("campaign_dashboard_development") }.to raise_error(ScaleCheck::Refused)
    expect { described_class.assert_scratch!("campaign_dashboard_development_scale_check") }.not_to raise_error
  end
end
