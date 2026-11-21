require "rails_helper"
require "rake"

RSpec.describe "import:all" do
  before(:all) { Rails.application.load_tasks unless Rake::Task.task_defined?("import:all") }

  let(:task) { Rake::Task["import:all"] }

  around do |example|
    old = ENV["DATA_DIR"]
    example.run
  ensure
    ENV["DATA_DIR"] = old
    task.reenable
  end

  it "forces a re-import and prints the summary" do
    with_import_dir do |dir|
      ENV["DATA_DIR"] = dir
      expect { task.invoke }.to output(/calls\.csv: 12 rows → 8 calls \(4 older versions dropped, 0 rejected; 8 inserted/).to_stdout
      task.reenable
      expect { task.invoke }.to output(/0 inserted, 0 updated, 0 local dates recomputed/).to_stdout
    end
  end

  it "re-imports even when calls already has data" do
    with_import_dir do |dir|
      ENV["DATA_DIR"] = dir
      expect { task.invoke }.to output.to_stdout
      Call.where(call_id: "c_008").delete_all
      task.reenable
      expect { task.invoke }.to output(/1 inserted/).to_stdout
    end
  end

  it "exits non-zero when a file is missing" do
    with_import_dir do |dir|
      File.delete(File.join(dir, "calls.csv"))
      ENV["DATA_DIR"] = dir
      expect { task.invoke }
        .to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
        .and output(/import failed: calls\.csv/).to_stderr
    end
  end
end
