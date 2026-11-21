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

  it "refuses a name Postgres would truncate back to the configured database" do
    base = "a" * 63

    expect { described_class.scratch_name(base, rails_env: "development") }
      .to raise_error(ScaleCheck::Refused, /truncate/)
    expect(described_class.scratch_name("a" * 51, rails_env: "development").bytesize).to eq(63)
  end

  it "counts bytes, not characters, against the identifier limit" do
    expect { described_class.scratch_name("é" * 26, rails_env: "development") }.to raise_error(ScaleCheck::Refused)
  end

  describe ".assert_scratch!" do
    it "only accepts scratch names that differ from the configured database" do
      base = "campaign_dashboard_development"

      expect { described_class.assert_scratch!(base, base: base) }.to raise_error(ScaleCheck::Refused)
      expect { described_class.assert_scratch!("#{base}_scale_check", base: base) }.not_to raise_error
    end

    it "refuses an over-long name and a name equal to the base" do
      long = "#{'a' * 60}_scale_check"

      expect { described_class.assert_scratch!(long, base: "a" * 60) }.to raise_error(ScaleCheck::Refused, /truncate/)
      expect { described_class.assert_scratch!("x_scale_check", base: "x_scale_check") }.to raise_error(ScaleCheck::Refused, /configured/)
    end
  end

  it "validates the derived name before any DROP or CREATE" do
    config = ActiveRecord::Base.connection_db_config.configuration_hash.merge(database: "a" * 63)
    allow(ActiveRecord::Base.connection_db_config).to receive(:configuration_hash).and_return(config)
    expect(ActiveRecord::Base).not_to receive(:establish_connection)

    expect { described_class.new(out: StringIO.new, env: {}).run }.to raise_error(ScaleCheck::Refused)
  end
end
