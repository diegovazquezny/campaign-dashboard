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

  # These run the task for real on a tiny dataset. They create and drop
  # `<test db>_scale_check`, so they cannot be transactional.
  describe "against a real scratch database", :real_data do
    self.use_transactional_tests = false

    let(:base) { ActiveRecord::Base.connection_db_config.configuration_hash[:database] }
    let(:scratch) { "#{base}#{described_class::SUFFIX}" }
    let(:out) { StringIO.new }

    def database_exists?(name)
      ActiveRecord::Base.connection.select_value("SELECT 1 FROM pg_database WHERE datname = #{ActiveRecord::Base.connection.quote(name)}")
    end

    def run_task(env)
      described_class.new(out: out, env: { "CALLS" => "300", "CAMPAIGNS" => "5", "OFFICES" => "3" }.merge(env)).run
    end

    it "builds the dataset, prints plans, drops the scratch database and restores the connection" do
      run_task({})

      expect(out.string).to include("dropped #{scratch}")
      expect(database_exists?(scratch)).to be_nil
      expect(ActiveRecord::Base.connection.current_database).to eq(base)
    end

    it "drops the scratch database and restores the connection when the run fails" do
      expect { run_task("CAMPAIGNS" => "0") }.to raise_error(ActiveRecord::ActiveRecordError)

      expect(database_exists?(scratch)).to be_nil
      expect(ActiveRecord::Base.connection.current_database).to eq(base)
    end

    it "refuses, before loading the schema or inserting, when connected to the wrong database" do
      allow_any_instance_of(ActiveRecord::ConnectionAdapters::PostgreSQLAdapter)
        .to receive(:current_database).and_return(base)

      expect { run_task({}) }.to raise_error(ScaleCheck::Refused, /is not a _scale_check database/)
      expect(database_exists?(scratch)).to be_nil
    end
  end
end
